/** Thrown by the permission/validation helpers; turned into a response by errorResponse. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
