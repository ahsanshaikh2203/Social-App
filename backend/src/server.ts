import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { PrismaClient, User, Post, Comment, Profile } from "@prisma/client";
import { z } from "zod";
import { WebSocketServer, WebSocket } from "ws";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { decodeSession, encodeSession, hashPassword, verifyPassword } from "./security.js";
import { ConnectionRegistry } from "./realtime.js";

export const prisma = new PrismaClient();
export const registry = new ConnectionRegistry();

export async function buildServer(options: { listen?: boolean } = {}) {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: config.frontendOrigin, credentials: true, methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"] });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: Math.max(config.maxImageSizeMb, config.maxVideoSizeMb) * 1024 * 1024 } });
  await app.register(rateLimit, { global: true, max: 300, timeWindow: "1 minute" });
  await app.register(swagger, { openapi: { info: { title: "Social Network API", version: "1.0.0" } } });
  await app.register(swaggerUi, { routePrefix: "/api/docs", uiConfig: { docExpansion: "list" } });
  app.get("/api/openapi.json", async () => app.swagger());

  await mkdir(config.mediaRoot, { recursive: true });

  app.setErrorHandler((error: any, _request, reply) => {
    if (error.name === "ZodError") return reply.status(422).send({ detail: error.issues?.[0]?.message ?? "Invalid request" });
    const status = error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    reply.status(status).send({ detail: error.detail ?? error.message ?? "Error" });
  });

  app.addHook("onRequest", async (request, reply) => {
    if (!["POST","PUT","PATCH","DELETE"].includes(request.method)) return;
    const exchange = ["/api/auth/register","/api/auth/login","/api/auth/logout"].includes(request.url);
    if (exchange) return;
    const token = getToken(request);
    if (token && !request.headers.authorization) {
      const csrfCookie = (request.cookies as any)?.csrf_token;
      if (!csrfCookie || request.headers["x-csrf-token"] !== csrfCookie) {
        return reply.status(403).send({ detail: "Missing or invalid CSRF token" });
      }
    }
  });

  async function getUser(request: any): Promise<User & { profile: Profile | null }> {
    let token: string | undefined;
    const auth = request.headers.authorization;
    if (typeof auth === "string" && auth.startsWith("Bearer ")) token = auth.slice(7);
    if (!token) token = (request.cookies as any)?.[config.sessionCookieName];
    const id = decodeSession(token);
    if (!id) throw Object.assign(new Error("Not authenticated"), { statusCode: 401 });
    const user = await prisma.user.findUnique({ where: { id }, include: { profile: true } });
    if (!user) throw Object.assign(new Error("Invalid session"), { statusCode: 401 });
    return user;
  }

  function sessionCookie(token: string) {
    return `${config.sessionCookieName}=${token}; Path=/; Max-Age=${config.sessionTtlSeconds}; HttpOnly; SameSite=Lax${config.secureCookie ? "; Secure" : ""}`;
  }
  function getToken(request: any) { const auth = request.headers.authorization; if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice(7); return (request.cookies as any)?.[config.sessionCookieName]; }
  function bad(reply: any, statusCode: number, detail: string) { return reply.status(statusCode).send({ detail }); }

  async function areBlocked(a: number, b: number) {
    return !!await prisma.block.findFirst({ where: { OR: [{ blockerId:a, blockedId:b }, { blockerId:b, blockedId:a }] } });
  }
  async function isFriend(a: number, b: number) {
    if (a === b) return true;
    return !!await prisma.friendRequest.findFirst({ where: { status:"accepted", OR:[{senderId:a,receiverId:b},{senderId:b,receiverId:a}] } });
  }
  async function canViewProfile(viewer: (User & { profile: Profile | null }) | null, owner: User & { profile: Profile | null }) {
    if (viewer?.id === owner.id) return true;
    if (!owner.profile) return false;
    if (await areBlocked(viewer?.id ?? -1, owner.id)) return false;
    if (owner.profile.profileVisibility === "public") return true;
    return owner.profile.profileVisibility === "friends" && !!viewer && await isFriend(viewer.id, owner.id);
  }
  async function canViewPost(viewer: (User & { profile: Profile | null }) | null, post: Post) {
    if (await areBlocked(viewer?.id ?? -1, post.userId)) return false;
    if (viewer?.id === post.userId) return true;
    if (post.audience === "public") return true;
    if (post.audience === "friends") return !!viewer && await isFriend(viewer.id, post.userId);
    return false;
  }
  async function profileOut(user: User & { profile: Profile | null }) {
    const p = user.profile;
    return { user_id:user.id, username:user.username, display_name:p?.displayName ?? user.username, avatar_url:p?.avatarUrl ?? null, bio:p?.bio ?? "", profile_visibility:p?.profileVisibility ?? "private", default_post_audience:p?.defaultPostAudience ?? "public", friend_requests_enabled:p?.friendRequestsEnabled ?? true, friends_list_visible:p?.friendsListVisible ?? true, created_at:user.createdAt };
  }
  async function postOut(post: Post & { user: User & { profile: Profile | null }; media: any[] }, viewer: User & { profile: Profile | null }) {
    const [likeCount, commentCount, liked] = await Promise.all([
      prisma.like.count({ where:{ postId:post.id } }),
      prisma.comment.count({ where:{ postId:post.id } }),
      viewer ? prisma.like.findFirst({ where:{ postId:post.id, userId:viewer.id } }).then(Boolean) : false,
    ]);
    return { id:post.id,user_id:post.userId,text:post.text,audience:post.audience,created_at:post.createdAt,updated_at:post.updatedAt,like_count:likeCount,comment_count:commentCount,liked,username:post.user.username,display_name:post.user.profile?.displayName ?? post.user.username,media:post.media.map(m=>({id:m.id,url:`/api/media/${m.id}`,media_type:m.mediaType,mime_type:m.mimeType})) };
  }
  async function commentOut(comment: Comment & { user: User & { profile: Profile | null } }) {
    return { id:comment.id,post_id:comment.postId,user_id:comment.userId,text:comment.text,created_at:comment.createdAt,username:comment.user.username,display_name:comment.user.profile?.displayName ?? comment.user.username };
  }
  async function notify(userId:number, actorId:number, type:string, link:string, message:string) {
    if (userId === actorId) return;
    await prisma.notification.create({ data:{ userId,actorId,type,link,message } });
  }
  async function withPost(id:number, viewer:(User & { profile:Profile|null }), includeMedia=true) {
    return prisma.post.findUnique({ where:{ id }, include:{ user:{ include:{ profile:true } }, media:includeMedia } });
  }

  app.get("/api/health", async () => ({ status:"ok" }));

  // Auth
  app.post("/api/auth/register", async (request, reply) => {
    const schema=z.object({username:z.string().regex(/^[A-Za-z0-9_]+$/).min(3).max(30),email:z.string().email(),password:z.string().min(10).max(128),display_name:z.string().min(1).max(100)});
    const p=schema.parse(request.body);
    const username=p.username.toLowerCase(), email=p.email.toLowerCase();
    if(await prisma.user.findFirst({where:{OR:[{username},{email}]}})) return bad(reply,409,"Username or email already in use");
    const user=await prisma.user.create({data:{username,email,passwordHash:await hashPassword(p.password),profile:{create:{displayName:p.display_name}}}});
    const token=encodeSession(user.id);
    reply.header("set-cookie",sessionCookie(token)).status(201).send({id:user.id,username:user.username});
  });
  app.post("/api/auth/login", async (request, reply) => {
    const p=z.object({username:z.string(),password:z.string()}).parse(request.body);
    const user=await prisma.user.findUnique({where:{username:p.username.toLowerCase()}});
    if(!user || !(await verifyPassword(p.password,user.passwordHash))) return bad(reply,401,"Invalid username or password");
    reply.header("set-cookie",sessionCookie(encodeSession(user.id))).send({id:user.id,username:user.username});
  });
  app.post("/api/auth/logout", async (_request,reply) => reply.header("set-cookie",`${config.sessionCookieName}=; Path=/; Max-Age=0`).send({ok:true}));
  app.get("/api/auth/me", async (request,reply) => { try { const u=await getUser(request); reply.send({id:u.id,username:u.username,email:u.email,display_name:u.profile?.displayName ?? u.username,avatar_url:u.profile?.avatarUrl ?? null}); } catch(e:any){ return bad(reply,e.statusCode??401,e.message); } });
  app.get("/api/auth/csrf", async (request,reply) => { const u=await getUser(request); const token=encodeSession(u.id); reply.header("set-cookie",`csrf_token=${token}; Path=/; SameSite=Lax${config.secureCookie?"; Secure":""}`).send({csrf_token:token}); });

  // Profiles
  app.get("/api/profiles/search", async (request,reply) => {
    const q=z.object({q:z.string().min(1).max(100)}).parse(request.query);
    let viewer:null|(User&{profile:Profile|null})=null; try{viewer=await getUser(request)}catch{}
    const users=await prisma.user.findMany({where:{OR:[{username:{contains:q.q,mode:"insensitive"}},{profile:{displayName:{contains:q.q,mode:"insensitive"}}}]},include:{profile:true},take:50});
    const out=[]; for(const u of users) if(await canViewProfile(viewer,u)) out.push(await profileOut(u));
    reply.send(out);
  });
  app.get("/api/profiles/me", async request => (await profileOut(await getUser(request))));
  app.get("/api/profiles/:user_id", async (request,reply) => {
    const param=String((request.params as any).user_id);
    const userId=Number(param);
    const viewer=await getUser(request);
    const u=await (Number.isInteger(userId)
      ? prisma.user.findUnique({where:{id:userId},include:{profile:true}})
      : prisma.user.findUnique({where:{username:param.toLowerCase()},include:{profile:true}}));
    if(!u || !(await canViewProfile(viewer,u))) return bad(reply,404,"Profile not found");
    const out=await profileOut(u);
    if(viewer.id!==u.id && !u.profile?.friendsListVisible && !(await isFriend(viewer.id,u.id))) out.friends_list_visible=false;
    if(viewer.id===u.id){
      (out as any).friendship_status="self";
    }else{
      if(await isFriend(viewer.id,u.id)){
        (out as any).friendship_status="friend";
      }else{
        const outgoing=await prisma.friendRequest.findFirst({where:{senderId:viewer.id,receiverId:u.id,status:"pending"},select:{id:true}});
        const incoming=await prisma.friendRequest.findFirst({where:{senderId:u.id,receiverId:viewer.id,status:"pending"},select:{id:true}});
        if(outgoing){
          (out as any).friendship_status="requested";
          (out as any).friend_request_id=outgoing.id;
        }else if(incoming){
          (out as any).friendship_status="incoming";
          (out as any).friend_request_id=incoming.id;
        }else{
          (out as any).friendship_status="none";
        }
      }
    }
    reply.send(out);
  });
  app.patch("/api/profiles/me", async (request,reply) => {
    const u=await getUser(request);
    const p=z.object({
      display_name:z.string().min(1).max(100).optional(),
      username:z.string().regex(/^[A-Za-z0-9_]+$/).min(3).max(30).optional(),
      avatar_url:z.string().nullable().optional(),
      bio:z.string().max(2000).nullable().optional()
    }).parse(request.body);
    if(p.username){
      const normalized=p.username.toLowerCase();
      const existing=await prisma.user.findFirst({where:{username:normalized,id:{not:u.id}}});
      if(existing) return bad(reply,409,"Username already in use");
      await prisma.user.update({where:{id:u.id},data:{username:normalized}});
    }
    await prisma.profile.update({where:{userId:u.id},data:{displayName:p.display_name ?? undefined,avatarUrl:p.avatar_url ?? undefined,bio:p.bio ?? undefined}});
    return profileOut(await prisma.user.findUniqueOrThrow({where:{id:u.id},include:{profile:true}}));
  });
  app.patch("/api/profiles/me/settings", async (request,reply) => { const u=await getUser(request); const p=z.object({profile_visibility:z.enum(["public","friends","private"]).optional(),default_post_audience:z.enum(["public","friends","private"]).optional(),friend_requests_enabled:z.boolean().optional(),friends_list_visible:z.boolean().optional()}).safeParse(request.body); if(!p.success) return bad(reply,422,"Invalid profile setting"); const d=p.data; await prisma.profile.update({where:{userId:u.id},data:{profileVisibility:d.profile_visibility,defaultPostAudience:d.default_post_audience,friendRequestsEnabled:d.friend_requests_enabled,friendsListVisible:d.friends_list_visible}}); return profileOut(await prisma.user.findUniqueOrThrow({where:{id:u.id},include:{profile:true}})); });

  // Posts/feed
  app.get("/api/posts/feed", async (request) => {
    const v=await getUser(request); const q=z.object({cursor:z.coerce.number().default(0),limit:z.coerce.number().default(20)}).parse(request.query); const limit=Math.min(Math.max(q.limit,1),100);
    const posts=await prisma.post.findMany({where:q.cursor?{id:{lt:q.cursor}}:{},orderBy:[{createdAt:"desc"},{id:"desc"}],take:limit*3,include:{user:{include:{profile:true}},media:true}});
    const allowed=[]; for(const p of posts) if(await canViewPost(v,p)) allowed.push(p); const selected=allowed.slice(0,limit); return Promise.all(selected.map(p=>postOut(p,v)));
  });
  app.get("/api/feed", async (request) => {
    const v=await getUser(request); const q=z.object({cursor:z.coerce.number().default(0),limit:z.coerce.number().default(20)}).parse(request.query); const limit=Math.min(Math.max(q.limit,1),100);
    const posts=await prisma.post.findMany({where:q.cursor?{id:{lt:q.cursor}}:{},orderBy:[{createdAt:"desc"},{id:"desc"}],take:limit*3,include:{user:{include:{profile:true}},media:true}});
    const allowed=[]; for(const p of posts) if(await canViewPost(v,p)) allowed.push(p); const selected=allowed.slice(0,limit); return Promise.all(selected.map(p=>postOut(p,v)));
  });
  app.post("/api/posts", async (request,reply) => { const v=await getUser(request); const p=z.object({text:z.string().max(5000).default(""),audience:z.string().default("public")}).parse(request.body); if(!["public","friends","private"].includes(p.audience)) return bad(reply,422,"Invalid audience"); const post=await prisma.post.create({data:{userId:v.id,text:p.text,audience:p.audience},include:{user:{include:{profile:true}},media:true}}); const friends=await prisma.friendRequest.findMany({where:{status:"accepted",OR:[{senderId:v.id},{receiverId:v.id}]}}); const ids=friends.map(r=>r.senderId===v.id?r.receiverId:r.senderId); registry.broadcast({type:"post.created",post:await postOut(post,v)},ids); reply.status(201).send(await postOut(post,v)); });
  app.get("/api/posts/profile/:user_id", async (request) => { const v=await getUser(request); const userId=Number((request.params as any).user_id); const q=z.object({cursor:z.coerce.number().default(0),limit:z.coerce.number().default(20)}).parse(request.query); const limit=Math.min(Math.max(q.limit,1),100); if(!await prisma.user.findUnique({where:{id:userId}})) throw Object.assign(new Error("User not found"),{statusCode:404}); const posts=await prisma.post.findMany({where:{userId,...(q.cursor?{id:{lt:q.cursor}}:{})},orderBy:[{createdAt:"desc"},{id:"desc"}],take:limit*3,include:{user:{include:{profile:true}},media:true}}); const allowed=[];for(const p of posts)if(await canViewPost(v,p))allowed.push(p);return Promise.all(allowed.slice(0,limit).map(p=>postOut(p,v)));});
  app.get("/api/posts/direct/:post_id", async (request,reply) => { const v=await getUser(request); const id=Number((request.params as any).post_id); const p=await withPost(id,v); if(!p||!(await canViewPost(v,p)))return bad(reply,404,"Post not found");reply.send(await postOut(p,v)); });
  app.get("/api/posts/:post_id", async (request,reply) => { const v=await getUser(request); const id=Number((request.params as any).post_id); const p=await withPost(id,v); if(!p||!(await canViewPost(v,p)))return bad(reply,404,"Post not found");reply.send(await postOut(p,v)); });
  app.patch("/api/posts/:post_id", async (request,reply) => { const v=await getUser(request); const id=Number((request.params as any).post_id); const p=await prisma.post.findUnique({where:{id},include:{user:{include:{profile:true}},media:true}});if(!p)return bad(reply,404,"Post not found");if(p.userId!==v.id)return bad(reply,403,"Only the post owner can edit it");const d=z.object({text:z.string().max(5000).nullable().optional(),audience:z.string().optional()}).parse(request.body);if(d.audience&&!["public","friends","private"].includes(d.audience))return bad(reply,422,"Invalid audience");const u=await prisma.post.update({where:{id},data:{text:d.text??undefined,audience:d.audience??undefined},include:{user:{include:{profile:true}},media:true}});reply.send(await postOut(u,v)); });
  app.delete("/api/posts/:post_id", async (request,reply) => { const v=await getUser(request); const id=Number((request.params as any).post_id);const p=await prisma.post.findUnique({where:{id}});if(!p)return bad(reply,404,"Post not found");if(p.userId!==v.id)return bad(reply,403,"Only the post owner can delete it");await prisma.post.delete({where:{id}});reply.status(204).send(); });

  function imageMimeMatch(data:Buffer,mime:string){
    if(mime==="image/jpeg")return data.length>=3&&data[0]===0xff&&data[1]===0xd8&&data[2]===0xff;
    if(mime==="image/png")return data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if(mime==="image/webp")return data.subarray(0,4).toString()==="RIFF"&&data.subarray(8,12).toString()==="WEBP";
    return false;
  }
  function randomName(){return Array.from({length:16},()=>Math.floor(Math.random()*256).toString(16).padStart(2,"0")).join("");}

  app.post("/api/profiles/me/avatar", async (request,reply)=>{
    const u=await getUser(request);const file=await (request as any).file();if(!file)return bad(reply,400,"Missing file");
    const chunks:Buffer[]=[];for await(const chunk of file.file)chunks.push(Buffer.from(chunk));const data=Buffer.concat(chunks);const mime=file.mimetype;
    if(data.length>config.maxImageSizeMb*1024*1024)return bad(reply,413,"Avatar exceeds size limit");
    if(!["image/jpeg","image/png","image/webp"].includes(mime))return bad(reply,415,"Only JPEG, PNG and WebP images are allowed");
    if(!imageMimeMatch(data,mime))return bad(reply,415,"Invalid image content");
    const ext=mime==="image/jpeg"?".jpg":mime==="image/png"?".png":".webp";const filename=`avatar-${randomName()}${ext}`;await writeFile(path.join(config.mediaRoot,filename),data);
    const media=await prisma.media.create({data:{userId:u.id,filename,mediaType:"avatar",mimeType:mime,size:data.length}});
    await prisma.profile.update({where:{userId:u.id},data:{avatarUrl:`/api/media/${media.id}`}});reply.send({avatar_url:`/api/media/${media.id}`});
  });
  app.post("/api/posts/:post_id/media", async (request,reply)=>{
    const v=await getUser(request);const postId=Number((request.params as any).post_id);const post=await prisma.post.findUnique({where:{id:postId}});if(!post||post.userId!==v.id)return bad(reply,404,"Post not found");
    const file=await (request as any).file();if(!file)return bad(reply,400,"Missing file");const chunks:Buffer[]=[];for await(const chunk of file.file)chunks.push(Buffer.from(chunk));const data=Buffer.concat(chunks);const mime=file.mimetype;let kind="";
    if(mime.startsWith("image/")){if(data.length>config.maxImageSizeMb*1024*1024)return bad(reply,413,"Image exceeds size limit");if(!["image/jpeg","image/png","image/webp"].includes(mime)||!imageMimeMatch(data,mime))return bad(reply,415,"Invalid image content");kind="image";}
    else if(mime.startsWith("video/")){if(data.length>config.maxVideoSizeMb*1024*1024)return bad(reply,413,"Video exceeds size limit");const mp4=data.subarray(4,8).toString()==="ftyp";const webm=data.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));if(!mp4&&!webm)return bad(reply,415,"Invalid or unsupported video content");kind="video";}
    else return bad(reply,415,"Only images and short videos are allowed");
    const ext=mime==="image/jpeg"?".jpg":mime==="image/png"?".png":mime==="image/webp"?".webp":".mp4";const filename=`${randomName()}${ext}`;await writeFile(path.join(config.mediaRoot,filename),data);
    const media=await prisma.media.create({data:{postId,userId:v.id,filename,mediaType:kind,mimeType:mime,size:data.length}});reply.send({id:media.id,url:`/api/media/${media.id}`,media_type:kind});
  });
  app.get("/api/posts/:post_id/comments", async (request,reply)=>{const v=await getUser(request);const id=Number((request.params as any).post_id);const post=await prisma.post.findUnique({where:{id}});if(!post||!(await canViewPost(v,post)))return bad(reply,404,"Post not found");const items=await prisma.comment.findMany({where:{postId:id},orderBy:{createdAt:"asc"},include:{user:{include:{profile:true}}}});reply.send(await Promise.all(items.map(commentOut)));});
  app.post("/api/posts/:post_id/comments", async (request,reply)=>{const v=await getUser(request);const id=Number((request.params as any).post_id);const post=await prisma.post.findUnique({where:{id}});if(!post||!(await canViewPost(v,post)))return bad(reply,404,"Post not found");const p=z.object({text:z.string().min(1).max(2000)}).parse(request.body);const c=await prisma.comment.create({data:{postId:id,userId:v.id,text:p.text},include:{user:{include:{profile:true}}}});await notify(post.userId,v.id,"comment",`/posts/${post.id}`,`${v.username} commented on your post`);const result=await commentOut(c);registry.broadcast({type:"comment.created",post_id:post.id,comment:result},[post.userId]);if(post.userId!==v.id)registry.broadcast({type:"notification",unread_delta:1},[post.userId]);reply.status(201).send(result);});
  app.delete("/api/posts/comments/:comment_id", async (request,reply)=>{const v=await getUser(request);const id=Number((request.params as any).comment_id);const c=await prisma.comment.findUnique({where:{id},include:{post:true}});if(!c)return bad(reply,404,"Comment not found");if(c.userId!==v.id&&c.post.userId!==v.id)return bad(reply,403,"Cannot delete this comment");await prisma.comment.delete({where:{id}});reply.status(204).send();});
  app.post("/api/posts/:post_id/like", async (request,reply)=>{const v=await getUser(request);const id=Number((request.params as any).post_id);const post=await prisma.post.findUnique({where:{id},include:{user:{include:{profile:true}},media:true}});if(!post||!(await canViewPost(v,post)))return bad(reply,404,"Post not found");const existing=await prisma.like.findFirst({where:{postId:id,userId:v.id}});if(!existing){await prisma.like.create({data:{postId:id,userId:v.id}});await notify(post.userId,v.id,"like",`/posts/${post.id}`,`${v.username} liked your post`);}registry.broadcast({type:"post.like",post_id:post.id,liked:true},[post.userId]);reply.send(await postOut(post,v));});
  app.delete("/api/posts/:post_id/like", async (request,reply)=>{const v=await getUser(request);const id=Number((request.params as any).post_id);const post=await prisma.post.findUnique({where:{id},include:{user:{include:{profile:true}},media:true}});if(!post||!(await canViewPost(v,post)))return bad(reply,404,"Post not found");await prisma.like.deleteMany({where:{postId:id,userId:v.id}});registry.broadcast({type:"post.like",post_id:post.id,liked:false},[post.userId]);reply.send(await postOut(post,v));});

  function friendRequestOut(r:{id:number;senderId:number;receiverId:number;status:string;createdAt:Date}){return{id:r.id,sender_id:r.senderId,receiver_id:r.receiverId,status:r.status,created_at:r.createdAt};}
  app.post("/api/friend-requests/:user_id", async (request,reply)=>{const s=await getUser(request);const receiverId=Number((request.params as any).user_id);const receiver=await prisma.user.findUnique({where:{id:receiverId},include:{profile:true}});if(!receiver)return bad(reply,404,"User not found");if(s.id===receiverId)return bad(reply,422,"Cannot friend yourself");const blocked=await areBlocked(s.id,receiverId);if(blocked)return bad(reply,403,"Friend request is blocked");if(!receiver.profile?.friendRequestsEnabled)return bad(reply,403,"Friend requests are disabled");const existing=await prisma.friendRequest.findFirst({where:{OR:[{senderId:s.id,receiverId},{senderId:receiverId,receiverId:s.id}]}});if(existing)return bad(reply,409,existing.status==="accepted"?"Already friends":"Friend request already exists");const r=await prisma.friendRequest.create({data:{senderId:s.id,receiverId,status:"pending"}});await notify(receiverId,s.id,"friend_request","/friends/pending",`${s.username} sent you a friend request`);registry.broadcast({type:"friend.request",request:friendRequestOut(r)},[receiverId]);registry.broadcast({type:"notification",unread_delta:1},[receiverId]);reply.status(201).send(friendRequestOut(r));});
  app.delete("/api/friend-requests/:request_id/cancel", async (request,reply)=>{const v=await getUser(request);const id=Number((request.params as any).request_id);const r=await prisma.friendRequest.findFirst({where:{id,senderId:v.id,status:"pending"}});if(!r)return bad(reply,404,"Pending outgoing request not found");await prisma.friendRequest.delete({where:{id}});reply.status(204).send();});
  app.post("/api/friend-requests/:request_id/accept", async (request,reply)=>{const v=await getUser(request);const id=Number((request.params as any).request_id);const r=await prisma.friendRequest.findFirst({where:{id,receiverId:v.id,status:"pending"}});if(!r)return bad(reply,404,"Pending incoming request not found");const u=await prisma.friendRequest.update({where:{id},data:{status:"accepted"}});await notify(r.senderId,v.id,"friend_accept",`/profiles/${v.id}`,`${v.username} accepted your friend request`);registry.broadcast({type:"friend.accepted",request:friendRequestOut(u)},[r.senderId,r.receiverId]);registry.broadcast({type:"notification",unread_delta:1},[r.senderId]);reply.send(friendRequestOut(u));});
  app.post("/api/friend-requests/:request_id/decline", async (request,reply)=>{const v=await getUser(request);const id=Number((request.params as any).request_id);const r=await prisma.friendRequest.findFirst({where:{id,receiverId:v.id,status:"pending"}});if(!r)return bad(reply,404,"Pending incoming request not found");await prisma.friendRequest.delete({where:{id}});reply.status(204).send();});
  app.delete("/api/friends/:user_id/unfriend", async (request,reply)=>{const v=await getUser(request);const uid=Number((request.params as any).user_id);const r=await prisma.friendRequest.findFirst({where:{status:"accepted",OR:[{senderId:v.id,receiverId:uid},{senderId:uid,receiverId:v.id}]}});if(!r)return bad(reply,404,"Friendship not found");await prisma.friendRequest.delete({where:{id:r.id}});registry.broadcast({type:"friend.unfriended",user_id:v.id},[uid]);reply.status(204).send();});
  app.post("/api/friends/:user_id/block", async (request,reply)=>{const v=await getUser(request);const uid=Number((request.params as any).user_id);if(uid===v.id)return bad(reply,422,"Cannot block yourself");if(!await prisma.user.findUnique({where:{id:uid}}))return bad(reply,404,"User not found");const existing=await prisma.block.findFirst({where:{blockerId:v.id,blockedId:uid}});if(!existing){await prisma.block.create({data:{blockerId:v.id,blockedId:uid}});await prisma.friendRequest.deleteMany({where:{OR:[{senderId:v.id,receiverId:uid},{senderId:uid,receiverId:v.id}]}});}registry.broadcast({type:"friend.blocked",user_id:uid},[uid]);reply.status(201).send({blocked:true});});
  app.get("/api/friends", async request=>{const v=await getUser(request);const rows=await prisma.friendRequest.findMany({where:{status:"accepted",OR:[{senderId:v.id},{receiverId:v.id}]}});const ids=new Set(rows.map(r=>r.senderId===v.id?r.receiverId:r.senderId));if(!ids.size)return [];const users=await prisma.user.findMany({where:{id:{in:[...ids]}},include:{profile:true}});return users.map(u=>({id:u.id,username:u.username,display_name:u.profile?.displayName??u.username}));});
  app.get("/api/friends/pending", async request=>{
    const v=await getUser(request);
    const incoming=await prisma.friendRequest.findMany({where:{receiverId:v.id,status:"pending"},include:{sender:{include:{profile:true}}}});
    const outgoing=await prisma.friendRequest.findMany({where:{senderId:v.id,status:"pending"},include:{receiver:{include:{profile:true}}}});
    return{
      incoming:incoming.map(r=>({...friendRequestOut(r),user:{id:r.sender.id,username:r.sender.username,display_name:r.sender.profile?.displayName??r.sender.username}})),
      outgoing:outgoing.map(r=>({...friendRequestOut(r),user:{id:r.receiver.id,username:r.receiver.username,display_name:r.receiver.profile?.displayName??r.receiver.username}}))
    };
  });

  app.get("/api/notifications", async request=>{const v=await getUser(request);const items=await prisma.notification.findMany({where:{userId:v.id},orderBy:{createdAt:"desc"},take:100});const unread=await prisma.notification.count({where:{userId:v.id,unread:true}});return{items:items.map(n=>({id:n.id,type:n.type,link:n.link,message:n.message,unread:n.unread,created_at:n.createdAt})),unread};});
  app.get("/api/notifications/unread", async (request) => {
    const viewer = await getUser(request);
    const unread = await prisma.notification.count({ where:{ userId:viewer.id, unread:true } });
    return { unread };
  });
  app.post("/api/notifications/:notification_id/read", async (request,reply)=>{const v=await getUser(request);const id=Number((request.params as any).notification_id);const n=await prisma.notification.findFirst({where:{id,userId:v.id}});if(!n)return bad(reply,404,"Notification not found");const u=await prisma.notification.update({where:{id},data:{unread:false}});reply.send({id:u.id,type:u.type,link:u.link,message:u.message,unread:u.unread,created_at:u.createdAt});});
  app.post("/api/notifications/read-all", async request=>{const v=await getUser(request);await prisma.notification.updateMany({where:{userId:v.id,unread:true},data:{unread:false}});return{ok:true};});

  app.get("/api/media/:media_id", async (request,reply)=>{
    const v=await getUser(request);const id=Number((request.params as any).media_id);const media=await prisma.media.findUnique({where:{id},include:{post:true}});if(!media)return bad(reply,404,"Media not found");
    if(media.postId&&media.post){if(!(await canViewPost(v,media.post)))return bad(reply,404,"Media not found");}
    else if(media.mediaType==="avatar"){const owner=await prisma.user.findUnique({where:{id:media.userId},include:{profile:true}});if(!owner||!(await canViewProfile(v,owner)))return bad(reply,404,"Media not found");}
    else if(media.userId!==v.id)return bad(reply,404,"Media not found");
    try{const data=await readFile(path.join(config.mediaRoot,media.filename));reply.header("content-type",media.mimeType).send(data);}catch{return bad(reply,404,"Media not found");}
  });

  const wss = new WebSocketServer({ server: app.server });
  wss.on("connection", async (socket: WebSocket, request) => {
    const url = new URL(request.url ?? "/ws", "http://localhost");
    let token = url.searchParams.get("token") ?? undefined;
    if (!token) {
      const cookieHeader = request.headers.cookie ?? "";
      const match = cookieHeader.split(";").map(v=>v.trim()).find(v=>v.startsWith(`${config.sessionCookieName}=`));
      if (match) token = decodeURIComponent(match.slice(match.indexOf("=")+1));
    }
    const userId = decodeSession(token);
    const user = userId ? await prisma.user.findUnique({ where:{ id:userId } }) : null;
    if (!user) { socket.close(1008, "Unauthorized"); return; }
    registry.connect(user.id, socket);
    socket.send(JSON.stringify({ type:"connected", user_id:user.id }));
    socket.on("close", () => registry.disconnect(user.id, socket));
  });

  if (options.listen !== false) await app.listen({ host:"0.0.0.0", port:config.port });
  return app;
}

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  buildServer().catch(error => { console.error(error); process.exit(1); });
}
