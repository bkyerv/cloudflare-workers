import { createClient } from "@supabase/supabase-js";
import { Router, Route, Request } from "itty-router";
import { json, status, withContent } from "itty-router-extras";

import { readFrom, writeTo } from "../utils/cache";

type MethodType = "GET" | "POST" | "PUPPY";

interface IRequest extends Request {
  method: MethodType; // method is required to be on the interface
  url: string; // url is required to be on the interface
  optional?: string;
}

interface IMethods {
  get: Route;
  post: Route;
  puppy: Route;
}
const router = Router<IRequest, IMethods>();

router.get("/", async function (request: IRequest): Promise<Response> {
  return new Response("hello world one two three");
});

router.get(
  "/articles",
  async function (
    request,
    { SUPABASE_URL, SUPABASE_ANON_KEY, ARTICLES },
    ctx: ExecutionContext
  ): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Max-Age": "86400",
    };
    if (request.method === "OPTIONS") {
      return new Response("OK", {
        headers: corsHeaders,
      });
    }

    const cachedArticles = await readFrom(ARTICLES, "/articles");
    if (cachedArticles) {
      return new Response(JSON.stringify(cachedArticles), {
        headers: {
          "Content-type": "application/json",
          ...corsHeaders,
        },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, ARTICLES);
    const { data } = await supabase.from("articles").select("*");
    await writeTo(ARTICLES, "/articles", data);
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
);

router.get(
  `/articles/:id`,
  async function (
    request: Request,
    { SUPABASE_URL, SUPABASE_ANON_KEY, ARTICLES }
  ): Promise<Response> {
    const { id } = request.params as any;
    const cachedArticles = await readFrom(ARTICLES, `/articles/${id}`);
    if (cachedArticles) {
      return json(cachedArticles);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data } = await supabase
      .from("articles")
      .select("*")
      .match({ id })
      .single();

    if (!data) {
      return status(404, "not found");
    }

    await writeTo(ARTICLES, `/articles/${id}`, data);
    return json(data);
  }
);

router.post(
  "/articles",
  withContent,
  async function (request: Request, { SUPABASE_URL, SUPABASE_ANON_KEY }) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { title, content } = request.content;

    try {
      const { data, error } = await supabase
        .from("articles")
        .insert([{ title, content }]);

      if (error) {
        return new Response(JSON.stringify(error), {
          "Content-type": "application/json",
        });
      }
      return new Response(JSON.stringify({ success: true, data }), {
        headers: {
          "Content-type": "application/json",
        },
      });
    } catch (e) {
      return new Response(JSON.stringify(e), {
        headers: {
          "Content-type": "application/json",
        },
      });
    }
  }
);

router.post(
  "/revalidate",
  withContent,
  async function (
    request: Request,
    { SUPABASE_URL, SUPABASE_ANON_KEY, ARTICLES }
  ): Promise<Response> {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { type, record, old_record } = request.content;
    if (type === "INSERT" || type === "UPDATE") {
      await writeTo(ARTICLES, `/articles/${record.id}`, record);
    }

    if (type === "DELETE") {
      await ARTICLES.delete(`/articles/${old_record.id}`);
    }

    const { data: articles } = await supabase.from("articles").select("*");
    await writeTo(ARTICLES, "/articles", articles);
    return json({ received: true });
  }
);

router.get(
  "/read-kv",
  async function (request, { ARTICLES }): Promise<Response> {
    const articles = await readFrom(ARTICLES, "/articles");
    return json(articles);
  }
);

router.get("/write-kv", async function (_, { ARTICLES }): Promise<Response> {
  const articles = [{ title: "test3" }, { title: "test4" }];
  await writeTo(ARTICLES, "/articles", articles);
  return json(articles);
});

router.get("*", function () {
  return status(404, "This route doesn't exist");
});

export default {
  fetch: router.handle,
};
