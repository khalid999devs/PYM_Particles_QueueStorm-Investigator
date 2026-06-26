export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
  };
}

export const errorResponse = (message: string, code: string): ErrorResponse => ({
  success: false,
  error: {
    message,
    code
  }
});
