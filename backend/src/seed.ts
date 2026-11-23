import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (await prisma.user.count()) {
    console.log("Database already seeded");
    return;
  }
  const demos = [
    ["alice", "Alice Johnson", "alice@example.com"],
    ["bob", "Bob Smith", "bob@example.com"],
    ["carol", "Carol Lee", "carol@example.com"],
  ] as const;
  const users = [];
  for (const [username, name, email] of demos) {
    users.push(await prisma.user.create({
      data: {
        username, email, passwordHash: await argon2.hash("password123"),
        profile: { create: { displayName: name, bio: `Demo profile for ${name}`, profileVisibility: "public" } },
      },
    }));
  }
  await prisma.friendRequest.create({ data: { senderId: users[0].id, receiverId: users[1].id, status: "accepted" } });
  const posts = await Promise.all([
    prisma.post.create({ data: { userId: users[0].id, text: "Welcome to the demo social network!", audience: "public" } }),
    prisma.post.create({ data: { userId: users[1].id, text: "Friends-only update.", audience: "friends" } }),
    prisma.post.create({ data: { userId: users[2].id, text: "Hello everyone!", audience: "public" } }),
  ]);
  await prisma.comment.create({ data: { postId: posts[0].id, userId: users[1].id, text: "Great to be here!" } });
  console.log("Seeded demo users: alice, bob, carol (password: password123)");
}

main().finally(() => prisma.$disconnect());
