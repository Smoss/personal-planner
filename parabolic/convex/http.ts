import { httpRouter } from "convex/server";
import { streamChat } from "./chat";

/**
 * HTTP Router for Convex HTTP Actions
 *
 * This file defines the routing for HTTP actions in the application.
 * Each route maps a URL path to an httpAction handler.
 */
const http = httpRouter();

http.route({
  path: "/chat/streamChat",
  method: "POST",
  handler: streamChat,
});

http.route({
  path: "/chat/streamChat",
  method: "OPTIONS",
  handler: streamChat,
});

export default http;
