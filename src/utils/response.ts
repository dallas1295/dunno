export class AppResponseUtil {
  static success(data: unknown) {
    return Response.json({ data }, { status: 200 });
  }
  static created(data: unknown) {
    return Response.json(
      { message: "Resource created successfully", data },
      { status: 201 },
    );
  }
  static badRequest(message: string) {
    return Response.json({ error: message }, { status: 400 });
  }
  static unauthorized(message: string) {
    return Response.json({ error: message }, { status: 401 });
  }
  static forbidden(message: string) {
    return Response.json({ error: message }, { status: 403 });
  }
  static notFound(message: string) {
    return Response.json({ error: message }, { status: 404 });
  }
  static tooManyRequests(message: string) {
    return Response.json({ error: message }, { status: 429 });
  }
  static internalError(message: string) {
    return Response.json({ error: message }, { status: 500 });
  }
}
