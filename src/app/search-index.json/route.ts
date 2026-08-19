import { getSearchIndex } from "../../lib/products";

export const dynamic = "force-static";

export function GET() {
  return Response.json(getSearchIndex());
}
