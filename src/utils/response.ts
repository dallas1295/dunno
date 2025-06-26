import type { NextApiResponse } from "next";

export interface ResponseShape {
  status?: number;
  message?: string;
  error?: string;
  data?: unknown;
}

export class ResponseUtil {
  static success(res: NextApiResponse, data: unknown) {
    res.status(200).json({ data });
  }

  static created(res: NextApiResponse, data: unknown) {
    res.status(201).json({
      message: "Resource created successfully",
      data,
    });
  }

  static badRequest(res: NextApiResponse, message: string) {
    res.status(400).json({ error: message });
  }

  static unauthorized(res: NextApiResponse, message: string) {
    res.status(401).json({ error: message });
  }

  static forbidden(res: NextApiResponse, message: string) {
    res.status(403).json({ error: message });
  }

  static notFound(res: NextApiResponse, message: string) {
    res.status(404).json({ error: message });
  }

  static tooManyRequests(res: NextApiResponse, message: string) {
    res.status(429).json({ error: message });
  }

  static internalError(res: NextApiResponse, message: string) {
    res.status(500).json({ error: message });
  }
}
