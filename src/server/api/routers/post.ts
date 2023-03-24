import { clerkClient } from "@clerk/nextjs/server";

import { createTRPCRouter, privateProcedure, publicProcedure } from "~/server/api/trpc";
import type { Post } from "@prisma/client";

import { filterUserForClient } from "~/server/helpers/filterUserForClient";
import { z } from "zod";

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
    create: privateProcedure
        .input(
            z.object({
                content: z.string().emoji().min(1).max(250),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const authorId = ctx.userId;
            const post = await ctx.prisma.post.create({
                data: {
                    authorId,
                    content: input.content,
                }
            });
            return post;
        })
});
