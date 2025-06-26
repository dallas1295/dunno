import { NextApiRequest, NextApiResponse } from "next";
import { ResponseUtil } from "@/utils/response";

export function requestSizeLimiter(maxSize: number) {
  return (req: NextApiRequest, res: NextApiResponse): boolean => {
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    if (contentLength > maxSize) {
      ResponseUtil.badRequest(res, "Payload too large");
      return false;
    }
    return true;
  };
}
