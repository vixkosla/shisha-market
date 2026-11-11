import {handleMemberRequest} from "@/server/member-api";
export const dynamic = "force-dynamic";
async function handle(request: Request, context: {params: Promise<{path: string[]}>}) {
  return handleMemberRequest(request, (await context.params).path);
}
export {handle as GET, handle as POST, handle as PATCH, handle as DELETE};
