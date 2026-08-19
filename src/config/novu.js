import { Novu } from "@novu/api";
import env from "./env.js";

export const novu = env.NOVU_SECRET_KEY
  ? new Novu({
      secretKey: env.NOVU_SECRET_KEY,
    })
  : null;
