// Thrown when a user is authenticated (valid token) but tries to access
// a resource they don't own or aren't allowed to touch.
// Routes catch this and return 403 Forbidden.
export class ForbiddenError extends Error {
  constructor(message = "You are not allowed to do this") {
    super(message);
    this.name = "ForbiddenError";
  }
}
