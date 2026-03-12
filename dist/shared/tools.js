"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.starterTools = void 0;
const baseInput = {
    kind: "input",
    enabled: true
};
const baseTransform = {
    kind: "transform",
    enabled: true
};
const baseOutput = {
    kind: "output",
    enabled: true
};
exports.starterTools = [
    {
        id: "tool_summarize",
        name: "Summarize",
        description: "Summarize selected text.",
        shortcut: "S",
        pipeline: [
            {
                id: "step_input_clipboard",
                name: "Clipboard Read",
                ...baseInput,
                config: { type: "clipboard-read" }
            },
            {
                id: "step_transform_summarize",
                name: "Summarize",
                ...baseTransform,
                config: {
                    type: "ai-text-gen",
                    prompt: "Summarize the following text."
                }
            },
            {
                id: "step_output_ui",
                name: "UI Display",
                ...baseOutput,
                config: { type: "ui-display" }
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
                id: "step_input_clipboard",
                name: "Clipboard Read",
                ...baseInput,
                config: { type: "clipboard-read" }
            },
            {
                id: "step_transform_grammar",
                name: "Fix Grammar",
                ...baseTransform,
                config: {
                    type: "ai-text-gen",
                    providerId: "provider_mock",
                    prompt: "Fix grammar and spelling without changing meaning."
                }
            },
            {
                id: "step_output_ui",
                name: "UI Display",
                ...baseOutput,
                config: { type: "ui-display" }
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
                id: "step_input_clipboard",
                name: "Clipboard Read",
                ...baseInput,
                config: { type: "clipboard-read" }
            },
            {
                id: "step_transform_json",
                name: "Extract JSON",
                ...baseTransform,
                config: {
                    type: "json-extract"
                }
            },
            {
                id: "step_output_ui",
                name: "UI Display",
                ...baseOutput,
                config: { type: "ui-display" }
            }
        ]
    }
];
