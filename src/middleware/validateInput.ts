import { validateEmail, validatePassword } from "@/utils/user";
import { ResponseUtil } from "@/utils/response";
import { NextApiRequest, NextApiResponse } from "next";

export async function validateLoginInput(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<boolean> {
  try {
    const body =
      req.body ??
      (await new Promise<any>((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => resolve(JSON.parse(data)));
        req.on("error", reject);
      }));

    if (!body.email || !body.password) {
      ResponseUtil.badRequest(res, "Email and password are required");
      return false;
    }

    if (!validateEmail(body.email)) {
      ResponseUtil.badRequest(res, "Invalid email format");
      return false;
    }

    if (!validatePassword(body.password)) {
      ResponseUtil.badRequest(res, "Invalid password format");
      return false;
    }

    return true;
  } catch (error: any) {
    ResponseUtil.badRequest(
      res,
      error instanceof Error ? error.message : "Invalid request body",
    );
    return false;
  }
}
