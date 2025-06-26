import { NextApiResponse } from "next";

export function setRequestIdHeader(res: NextApiResponse, requestId?: string) {
  const id = requestId || crypto.randomUUID();
  res.setHeader("X-Request-ID", id);
  return id;
}
