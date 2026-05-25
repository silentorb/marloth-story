import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll } from "bun:test";

beforeAll(() => {
  GlobalRegistrator.register({ url: "http://127.0.0.1:5173/" });
});

afterEach(() => {
  document.body.replaceChildren();
});

afterAll(async () => {
  await GlobalRegistrator.unregister();
});
