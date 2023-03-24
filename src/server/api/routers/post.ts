import type { User } from "@clerk/nextjs/dist/api";
import { clerkClient } from "@clerk/nextjs/server";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import type { Post } from "@prisma/client";

const filterUserForClient = (user: User) => {
    return { id: user.id, username: user.username, profilePicture: user.profileImageUrl }
}

const addUserDataToPosts = async (posts: Post[]) => {
    const users = (
        await clerkClient.users.getUserList({
            userId: posts.map((post) => post.authorId),
            limit: 100,
        })
    ).map(filterUserForClient);

    console.log(users);

    return posts.flatMap((post) => {
        const author = users.find((user) => user.id === post.authorId);

        // TODO: Figure out why we're not getting authors back sometimes
        if (!author || !author.username) {
            console.error("AUTHOR NOT FOUND", post);
            return [];
            // throw new TRPCError({
            //   code: "INTERNAL_SERVER_ERROR",
            //   message: `Author for post not found. POST ID: ${post.id}, USER ID: ${post.authorId}`,
            // });
        }

        return [
            {
                post,
                author: {
                    ...author,
                    username: author.username,
                },
            },
        ];
    });
};

export const postRouter = createTRPCRouter({
    getAll: publicProcedure.query(async ({ ctx }) => {
        const posts = await ctx.prisma.post.findMany({
            take: 100,
            orderBy: [{ createdAt: "desc" }],
        });

        return addUserDataToPosts(posts);
    }),
});
