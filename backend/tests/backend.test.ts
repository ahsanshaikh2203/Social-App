import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import WebSocket from "ws";
import argon2 from "argon2";
import { buildServer, prisma } from "../src/server.js";
import { verifyPassword, encodeSession } from "../src/security.js";

const integrationEnabled = Boolean(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);

describe("password compatibility", () => {
  it("verifies an existing-style Argon2 PHC hash", async () => {
    const hash = await argon2.hash("password123");
    expect(await verifyPassword("password123", hash)).toBe(true);
  });
});

describe.skipIf(!integrationEnabled)("FastAPI parity HTTP and WebSocket", () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let baseUrl = "";

  beforeAll(async () => {
    app = await buildServer({ listen:false });
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("registers and authenticates, and preserves privacy", async () => {
    const suffix = Date.now();
    const alice = await request(app.server).post("/api/auth/register").send({
      username:`alice${suffix}`, email:`alice${suffix}@example.com`, password:"password123", display_name:"Alice"
    });
    expect(alice.status).toBe(201);
    const bob = await request(app.server).post("/api/auth/register").send({
      username:`bob${suffix}`, email:`bob${suffix}@example.com`, password:"password123", display_name:"Bob"
    });
    expect(bob.status).toBe(201);
    const aliceToken = encodeSession(alice.body.id);
    const bobToken = encodeSession(bob.body.id);
    expect((await request(app.server).get("/api/auth/me").set("Authorization",`Bearer ${aliceToken}`)).status).toBe(200);

    await request(app.server).patch("/api/profiles/me/settings")
      .set("Authorization",`Bearer ${aliceToken}`).send({ profile_visibility:"private" });
    expect((await request(app.server).get(`/api/profiles/${alice.body.id}`)
      .set("Authorization",`Bearer ${bobToken}`)).status).toBe(404);
  });

  it("handles friend transitions", async () => {
    const suffix = Date.now();
    const a = await request(app.server).post("/api/auth/register").send({username:`fa${suffix}`,email:`fa${suffix}@e.com`,password:"password123",display_name:"A"});
    const b = await request(app.server).post("/api/auth/register").send({username:`fb${suffix}`,email:`fb${suffix}@e.com`,password:"password123",display_name:"B"});
    const ta=encodeSession(a.body.id), tb=encodeSession(b.body.id);
    const sent=await request(app.server).post(`/api/friend-requests/${b.body.id}`).set("Authorization",`Bearer ${ta}`);
    expect(sent.status).toBe(201);
    const accepted=await request(app.server).post(`/api/friend-requests/${sent.body.id}/accept`).set("Authorization",`Bearer ${tb}`);
    expect(accepted.status).toBe(200);
  });

  it("supports search, pending friend lists, and mark-all-read", async () => {
    const suffix = Date.now();
    const alice = await request(app.server).post("/api/auth/register").send({username:`searcha${suffix}`,email:`searcha${suffix}@e.com`,password:"password123",display_name:"Search Alice"});
    const bob = await request(app.server).post("/api/auth/register").send({username:`searchb${suffix}`,email:`searchb${suffix}@e.com`,password:"password123",display_name:"Search Bob"});
    const aliceToken = encodeSession(alice.body.id);
    const bobToken = encodeSession(bob.body.id);

    const search = await request(app.server).get(`/api/profiles/search?q=searchb${suffix}`).set("Authorization",`Bearer ${aliceToken}`);
    expect(search.status).toBe(200);
    expect(search.body[0].username).toBe(`searchb${suffix}`);

    const profile = await request(app.server).get(`/api/profiles/searchb${suffix}`).set("Authorization",`Bearer ${aliceToken}`);
    expect(profile.status).toBe(200);

    const sent = await request(app.server).post(`/api/friend-requests/${bob.body.id}`).set("Authorization",`Bearer ${aliceToken}`);
    expect(sent.status).toBe(201);
    const pending = await request(app.server).get("/api/friends/pending").set("Authorization",`Bearer ${bobToken}`);
    expect(pending.status).toBe(200);
    expect(pending.body.incoming[0].user.username).toBe(`searcha${suffix}`);

    const notifications = await request(app.server).post("/api/notifications/read-all").set("Authorization",`Bearer ${bobToken}`);
    expect(notifications.status).toBe(200);
  });

  it("rejects invalid uploads", async () => {
    const suffix=Date.now();
    const u=await request(app.server).post("/api/auth/register").send({username:`up${suffix}`,email:`up${suffix}@e.com`,password:"password123",display_name:"Upload"});
    const token=encodeSession(u.body.id);
    const post=await request(app.server).post("/api/posts").set("Authorization",`Bearer ${token}`).send({text:"photo",audience:"public"});
    const res=await request(app.server).post(`/api/posts/${post.body.id}/media`).set("Authorization",`Bearer ${token}`).attach("file","not an image",{filename:"bad.txt",contentType:"text/plain"});
    expect(res.status).toBe(415);
  });

  it("requires authentication for native WebSockets", async () => {
    await app.listen({host:"127.0.0.1",port:0});
    const address=app.server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    baseUrl=`ws://127.0.0.1:${address.port}/ws`;
    await expect(new Promise<void>((resolve,reject)=>{
      const socket=new WebSocket(baseUrl);
      socket.on("error",reject);
      socket.on("close",(code)=>code===1008?resolve():reject(new Error(`Unexpected close ${code}`)));
    })).resolves.toBeUndefined();
  });
});
