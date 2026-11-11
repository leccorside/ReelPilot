import { describe, expect, it } from "vitest";
import { emptySeriesForm, firstFormProblem, sectionProblem, suggestSeriesName } from "./series-form";

describe("suggestSeriesName", () => {
  it("takes the first words and keeps the user's capitalization", () => {
    expect(suggestSeriesName("Aleksandra Wiśniewska-Kowalczyk conta lendas da Polônia")).toBe("Aleksandra Wiśniewska-Kowalczyk conta");
    expect(suggestSeriesName("Calm bedtime stories for kids")).toBe("Calm bedtime stories for");
  });

  it("skips pasted links instead of turning them into the name", () => {
    const pasted =
      "https://www.tiktok.com/@aleksandra.wisniewska.k/video/7436291847562918273?is_from_webapp=1&sender_device=pc histórias de terror";
    expect(suggestSeriesName(pasted)).toBe("histórias de terror");
    expect(suggestSeriesName("www.example.com/canal mistérios")).toBe("mistérios");
  });

  it("never cuts a word, stays short and drops trailing punctuation", () => {
    const long = "Vídeos curtos contando lendas urbanas e casos reais pouco conhecidos do interior do Brasil";
    const name = suggestSeriesName(long);
    expect(name).toBe("Vídeos curtos contando lendas");
    expect(name.length).toBeLessThanOrEqual(40);
    expect(suggestSeriesName("F1, notícias e bastidores")).toBe("F1, notícias e bastidores");
    expect(suggestSeriesName("Mistérios do mar: lendas")).toBe("Mistérios do mar: lendas");
    expect(suggestSeriesName("Mistérios, ")).toBe("Mistérios");
  });

  it("handles leading spaces, line breaks, a single huge word and nothing usable", () => {
    expect(suggestSeriesName("\n\n  Calm   stories ")).toBe("Calm stories");
    expect(Array.from(suggestSeriesName("Supercalifragilisticexpialidocious".repeat(3)))).toHaveLength(40);
    expect(suggestSeriesName("https://only-a-link.example.com")).toBe("");
    expect(suggestSeriesName("")).toBe("");
  });
});

describe("sectionProblem", () => {
  const base = { ...emptySeriesForm(), formats: ["facts"], niche: "F1", voice: "adam", artStyle: "realism", captionStyle: "bold", name: "F1" };

  it("accepts two-letter niches like F1 and AI", () => {
    expect(sectionProblem("formats", base)).toBeNull();
    expect(sectionProblem("formats", { ...base, niche: " A " })).toMatch(/at least 2 characters/);
  });

  it("explains each blocked step in words", () => {
    expect(sectionProblem("formats", { ...base, formats: [] })).toBe("Choose at least one format.");
    expect(sectionProblem("formats", { ...base, niche: "x".repeat(1001) })).toBe("The description can have at most 1,000 characters.");
    expect(sectionProblem("voice", { ...base, voice: "" })).toBe("Choose a voice.");
    expect(sectionProblem("schedule", { ...base, name: "" })).toBe("Give your series a name.");
    expect(sectionProblem("schedule", { ...base, name: "n".repeat(147) })).toBe("The series name can have at most 80 characters (now 147).");
    expect(sectionProblem("schedule", { ...base, postTime: "" })).toBe("Choose a posting time.");
  });

  it("reports the first problem of the whole form", () => {
    expect(firstFormProblem(base)).toBeNull();
    expect(firstFormProblem({ ...base, artStyle: "", name: "" })).toBe("Choose an art style.");
  });
});
