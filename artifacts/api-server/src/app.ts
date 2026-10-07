import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";
import { ApiProblem } from "./lib/school-core";
import type { ErrorRequestHandler } from "express";

const app: Express = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: false }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware((req) => ({
  publishableKey: publishableKeyFromHost(getClerkProxyHost(req) ?? "", process.env.CLERK_PUBLISHABLE_KEY),
})));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin) {
      try {
        if (new URL(origin).host !== getClerkProxyHost(req)) return next(new ApiProblem(403, "الطلب يجب أن يصدر من موقع المدرسة نفسه"));
      } catch {
        return next(new ApiProblem(403, "مصدر الطلب غير صحيح"));
      }
    } else if (req.get("sec-fetch-site") === "cross-site") {
      return next(new ApiProblem(403, "الطلب يجب أن يصدر من موقع المدرسة نفسه"));
    }
  }
  next();
});

app.use("/api", router);
app.use("/api", (_req, res) => { res.status(404).json({ message: "المسار المطلوب غير موجود" }); });

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ApiProblem) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  const failure = error as { code?: string; cause?: { code?: string }; status?: number; type?: string };
  const code = failure.code ?? failure.cause?.code;
  if (code === "23505") {
    res.status(400).json({ message: "هذا الرقم أو الاسم مسجل مسبقاً ضمن نفس الصف أو الفترة. تحقق من التكرار." });
  } else if (code === "23503") {
    res.status(400).json({ message: "السجل مرتبط ببيانات أخرى ولا يمكن حذفه أو نقله بهذه الطريقة" });
  } else if (failure.status === 413) {
    res.status(413).json({ message: "حجم الطلب كبير جداً" });
  } else if (failure.type === "entity.parse.failed") {
    res.status(400).json({ message: "بيانات الطلب ليست JSON صالحاً" });
  } else {
    logger.error({ code: code ?? "unknown" }, "School API request failed");
    res.status(500).json({ message: "تعذر تنفيذ العملية. حاول مجدداً، وإذا استمر الخطأ تواصل مع مدير النظام." });
  }
};
app.use(errorHandler);

export default app;
