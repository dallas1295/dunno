import { router, publicProcedure, protectedProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { tokenService } from "@/services/token";
import { getNoteService } from "@/config/service";

export const noteRouter = router({});
