"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.starterTools = void 0;
exports.starterTools = [
    {
        id: "tool_summarize",
        name: "Summarize",
        description: "Summarize selected text.",
        shortcut: "S",
        pipeline: [
            {
                id: "step_transform_summarize",
                name: "Summarize",
                kind: "transform",
                enabled: true,
                config: { type: "ai-text-gen", prompt: "Summarize the following text." }
            }
        ]
    },
    {
        id: "tool_fix_grammar",
        name: "Fix Grammar",
        description: "Clean up spelling and grammar.",
        shortcut: "G",
        pipeline: [
            {
                id: "step_transform_grammar",
                name: "Fix Grammar",
                kind: "transform",
                enabled: true,
                config: { type: "ai-text-gen", prompt: "Fix grammar and spelling without changing meaning." }
            }
        ]
    },
    {
        id: "tool_extract_json",
        name: "Extract JSON",
        description: "Extract structured JSON from text.",
        shortcut: "J",
        pipeline: [
            {
                id: "step_transform_json",
                name: "Extract JSON",
                kind: "transform",
                enabled: true,
                config: { type: "json-extract" }
            }
        ]
    }
];
