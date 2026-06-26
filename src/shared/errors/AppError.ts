export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  public constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }

  public static validation(message = "Invalid request body"): AppError {
    return new AppError(message, 400, "VALIDATION_ERROR");
  }

  public static unprocessable(message: string, code: string): AppError {
    return new AppError(message, 422, code);
  }
}
