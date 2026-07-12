export type Accent = 'cobalt' | 'teal' | 'leaf' | 'violet' | 'ember';

export interface NoteTag {
  t: string;
  a: Accent;
}

export type NoteBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; language: string; code: string }
  | { type: 'callout'; title: string; text: string };

export interface NoteSection {
  heading: string;
  blocks: NoteBlock[];
}

export interface Note {
  slug: string;
  title: string;
  kind: string;
  dek: string;
  accent: Accent;
  tags: NoteTag[];
  sourceUrl: string;
  sourceLabel: string;
  sections: NoteSection[];
}

export const notes: Note[] = [
  {
    slug: 'fara-7b-on-12gb-vram',
    title: 'Fitting a 7B agent into 12 GB of VRAM',
    kind: 'field note',
    dek: 'Running a vision-language computer-use agent locally by splitting GPU inference on Windows from browser automation in WSL.',
    accent: 'violet',
    tags: [{ t: 'agents', a: 'violet' }, { t: 'quantization', a: 'cobalt' }],
    sourceUrl: 'https://github.com/microsoft/fara',
    sourceLabel: 'Microsoft Fara repository',
    sections: [
      {
        heading: 'The constraint',
        blocks: [
          { type: 'p', text: 'I wanted to test Microsoft Fara-7B locally on an RTX 3060 with 12 GB of VRAM and a Pentium Gold CPU. The full-precision model was too large for the card, while compiling and CPU inference were poor fits for the processor.' },
          { type: 'p', text: 'The useful question was not whether the entire stack could live in one environment. It was which environment should own each expensive or platform-sensitive part.' },
          { type: 'callout', title: 'Working split', text: 'Windows served the quantized vision-language model through llama.cpp and CUDA. WSL ran the Python agent and Playwright browser automation.' },
        ],
      },
      {
        heading: 'Fit the model first',
        blocks: [
          { type: 'p', text: 'A GGUF quantization made the model practical on the 12 GB card. Q6_K was the quality-oriented choice at roughly 6.4 GB; Q4_K_M offered more headroom and speed. The multimodal projector remained a separate required file because screenshots are part of the model input.' },
          { type: 'code', language: 'bash', code: 'huggingface-cli download mradermacher/Fara-7B-GGUF \\\n  Fara-7B.Q6_K.gguf --local-dir .\n\nhuggingface-cli download mradermacher/Fara-7B-GGUF \\\n  Fara-7B.mmproj-f16.gguf --local-dir .' },
        ],
      },
      {
        heading: 'Serve inference on Windows',
        blocks: [
          { type: 'p', text: 'Using prebuilt llama.cpp CUDA binaries avoided a long local compile. The context window mattered: browser tasks accumulate screenshots, tool messages, and observations quickly, so an 8192-token context prevented early context-limit failures in this trial.' },
          { type: 'code', language: 'powershell', code: '.\\llama-server.exe `\n  -m "I:\\AI\\fara\\model_weights\\Fara-7B.Q6_K.gguf" `\n  --mmproj "I:\\AI\\fara\\model_weights\\Fara-7B.mmproj-f16.gguf" `\n  --host 0.0.0.0 --port 8081 -ngl 99 -c 8192' },
        ],
      },
      {
        heading: 'Bridge WSL to the host',
        blocks: [
          { type: 'p', text: 'The agent in WSL could not assume that localhost meant the Windows host. I resolved the host address from the WSL default route and pointed the OpenAI-compatible endpoint configuration at port 8081.' },
          { type: 'code', language: 'bash', code: "ip route show | grep -i default | awk '{ print $3 }'" },
          { type: 'list', items: ['Install Fara and Playwright inside a Python virtual environment in WSL.', 'Set the endpoint base URL to the Windows host address returned by the route command.', 'Keep the browser controller in Linux and the GPU-heavy server native on Windows.'] },
        ],
      },
      {
        heading: 'What the experiment established',
        blocks: [
          { type: 'p', text: 'The agent ran and could control the browser at usable speed. This was a feasibility test, not a benchmark: I did not produce a rigorous task-success evaluation, and accuracy still needed systematic checking.' },
          { type: 'p', text: 'The broader lesson is architectural. Constrained local AI often works when model format, inference runtime, and automation environment are treated as separable decisions rather than one installation problem.' },
        ],
      },
    ],
  },
  {
    slug: 'voice-driven-point-of-sale',
    title: 'Voice-driven point of sale',
    kind: 'project note',
    dek: 'Turning spoken orders and photographed receipts into structured operations without confusing an AI interpretation with a completed transaction.',
    accent: 'teal',
    tags: [{ t: 'speech', a: 'teal' }, { t: 'agents', a: 'violet' }],
    sourceUrl: 'https://github.com/Ibtisam-Mohammad/AI-Point-of-Sale-app',
    sourceLabel: 'VentiPOS repository',
    sections: [
      {
        heading: 'Why voice belongs before the cart',
        blocks: [
          { type: 'p', text: 'VentiPOS explores a simple interaction: speak an order and receive a structured, itemized cart. The hard part is not recording audio. It is translating informal language into products, variants, quantities, and prices that agree with the inventory.' },
          { type: 'callout', title: 'Boundary', text: 'The model proposes structure. Inventory data validates it. The user confirms it. Only then should the system record a sale.' },
        ],
      },
      {
        heading: 'The product loop',
        blocks: [
          { type: 'list', items: ['Capture the spoken order in the browser.', 'Use Gemini to convert the utterance into structured line items.', 'Resolve names and variants against the inventory catalogue.', 'Present ambiguities or unavailable items before checkout.', 'Commit the confirmed order and update history, stock, customer data, and analytics.'] },
          { type: 'p', text: 'The same structured-extraction pattern supports receipt images. Gemini parses a photographed receipt into candidate stock updates, which can then be reviewed before inventory changes.' },
        ],
      },
      {
        heading: 'State is the real centre',
        blocks: [
          { type: 'p', text: 'The Angular application separates audio recording, order processing, inventory, customers, history, analytics, and notifications into components and services. A shared POS state coordinates the workflow. That separation matters because model output is only one event in a larger transaction system.' },
          { type: 'p', text: 'A useful implementation keeps raw model responses, normalized candidates, validation errors, and committed records distinct. That makes corrections possible and prevents a fluent response from silently becoming business data.' },
        ],
      },
      {
        heading: 'What production would require',
        blocks: [
          { type: 'list', items: ['Move model credentials and transaction writes behind an authenticated server.', 'Use catalogue IDs rather than product-name strings as the durable key.', 'Add confirmation for low-confidence matches and destructive inventory changes.', 'Record an audit trail from transcript to interpreted order to final transaction.', 'Evaluate with noisy speech, accents, corrections, compound orders, and out-of-stock variants.'] },
          { type: 'p', text: 'Voice can reduce interaction cost, but only if uncertainty is visible. The design goal is not a cashier-shaped chatbot; it is a faster path to a correct transaction.' },
        ],
      },
    ],
  },
  {
    slug: 'vehicle-wait-time-detector',
    title: 'Vehicle wait-time detector',
    kind: 'project note',
    dek: 'Why dwell-time measurement is a tracking and state-management problem after the detector has drawn its first box.',
    accent: 'leaf',
    tags: [{ t: 'vision', a: 'leaf' }, { t: 'tracking', a: 'teal' }],
    sourceUrl: 'https://github.com/Ibtisam-Mohammad/Vehicle_Wait_Time_Detector',
    sourceLabel: 'Vehicle detector repository',
    sections: [
      {
        heading: 'Detection is only the first frame',
        blocks: [
          { type: 'p', text: 'The system detects vehicles with YOLO and associates them across frames with the Ultralytics tracking interface, using ByteTrack by default. A user-defined polygon marks the region where waiting matters.' },
          { type: 'p', text: 'The actual product metric is cumulative time inside that polygon. That requires a stable identity, an entry rule, an exit rule, and memory that survives temporary missed detections.' },
        ],
      },
      {
        heading: 'A small state machine per track',
        blocks: [
          { type: 'list', items: ['Use the bounding-box centre point to decide whether a vehicle is inside the ROI.', 'Start or resume its timer when the centre enters.', 'Accumulate elapsed time while the track remains inside.', 'Keep state for a configurable lost-frame buffer during short occlusions.', 'Finalize the record when the track exits or expires.'] },
          { type: 'p', text: 'The centre-point rule is computationally cheap and predictable. It is also a policy choice: for a bus or truck straddling the boundary, area overlap may describe occupancy better than a single point.' },
        ],
      },
      {
        heading: 'Identity errors become timing errors',
        blocks: [
          { type: 'p', text: 'Short occlusions are handled by ByteTrack and a lost-frame buffer. Longer occlusions can create a new identity, while close vehicles can exchange IDs. Both failures corrupt dwell time even when every visible box looks correct.' },
          { type: 'callout', title: 'Next improvement', text: 'Appearance-based re-identification would combine motion and overlap with a visual embedding, reducing identity switches and reconnecting tracks after longer occlusions.' },
        ],
      },
      {
        heading: 'Outputs and operational choices',
        blocks: [
          { type: 'p', text: 'The pipeline emits an annotated video with boxes, IDs, ROI, and timers, plus a JSON report containing per-vehicle wait times. It can run from a CLI, Docker, or a Streamlit interface.' },
          { type: 'list', items: ['Use a high, fixed camera angle to reduce overlap and camera motion.', 'Tune confidence, tracker buffer, and ROI geometry for each scene.', 'Preserve frame rate and timestamps; timing is only as reliable as the video clock.', 'Evaluate ID switches and dwell-time error, not detector precision alone.'] },
        ],
      },
    ],
  },
  {
    slug: 'yolov11-auto-annotation-cvat',
    title: 'YOLOv11 auto-annotation for CVAT',
    kind: 'project note',
    dek: 'Wrapping a custom detector in CVAT’s serverless contract so model predictions become editable annotations rather than a separate pipeline.',
    accent: 'ember',
    tags: [{ t: 'vision', a: 'leaf' }, { t: 'annotation', a: 'ember' }],
    sourceUrl: 'https://github.com/Ibtisam-Mohammad/custom-yolov11-auto-annotation-cvat',
    sourceLabel: 'CVAT integration repository',
    sections: [
      {
        heading: 'Move inference to where labels are made',
        blocks: [
          { type: 'p', text: 'A custom detector is most useful to an annotation team when it appears inside the annotation tool. This integration packages YOLOv11 as a Nuclio HTTP function that CVAT can invoke for automatic annotation.' },
          { type: 'p', text: 'The model does not replace review. It changes the starting point from an empty frame to a set of editable rectangles with labels and confidence values.' },
        ],
      },
      {
        heading: 'The handler contract',
        blocks: [
          { type: 'list', items: ['Load the YOLO model once during function initialization.', 'Decode CVAT’s base64 image payload with OpenCV.', 'Read the requested confidence threshold, defaulting to 0.1.', 'Run inference and support regular or oriented-box result objects.', 'Clamp and slightly expand coordinates before returning CVAT rectangle shapes.'] },
          { type: 'code', language: 'json', code: '[\n  {\n    "confidence": "0.91",\n    "label": "car",\n    "type": "rectangle",\n    "points": [118, 74, 436, 292]\n  }\n]' },
        ],
      },
      {
        heading: 'Translate model semantics explicitly',
        blocks: [
          { type: 'p', text: 'CVAT needs a declared label specification in the Nuclio function metadata. Model class indices, returned label names, and project labels must agree. A technically correct box is unusable if the semantic mapping drifts.' },
          { type: 'p', text: 'The handler also applies a simple confidence-sorted IoU filter at 0.5 to remove duplicate boxes. This is intentionally visible application logic, not an assumption hidden inside the model runtime.' },
        ],
      },
      {
        heading: 'Deployment lessons',
        blocks: [
          { type: 'list', items: ['Pin the Ultralytics version to the version used around model training and export.', 'Match the function label spec to the custom dataset, not the default COCO list.', 'Size request limits and timeouts for the image resolution used by annotators.', 'Measure annotation correction time and acceptance rate, not raw inference throughput alone.', 'Treat auto-labels as proposed data with provenance: model version, threshold, and run time.'] },
          { type: 'p', text: 'The useful unit of automation is not boxes per second. It is verified labels per annotator-hour.' },
        ],
      },
    ],
  },
  {
    slug: 'ai-support-refund-agent',
    title: 'AI support refund agent',
    kind: 'project note',
    dek: 'A tool-calling support agent where the language model can investigate and explain, but a deterministic policy engine owns every financial verdict.',
    accent: 'violet',
    tags: [{ t: 'agents', a: 'violet' }, { t: 'evals', a: 'teal' }],
    sourceUrl: 'https://github.com/Ibtisam-Mohammad/ai-support-refund-agent',
    sourceLabel: 'Refund agent repository',
    sections: [
      {
        heading: 'Separate conversation from authority',
        blocks: [
          { type: 'p', text: 'The agent helps a customer find an order, understand policy, and open a refund case. It does not decide whether money moves. Approval, denial, escalation, and payout amount come from a deterministic policy engine.' },
          { type: 'callout', title: 'Invariant', text: 'Prompt injection may change the model’s wording. It cannot change the verdict because the model has no financial authority.' },
        ],
      },
      {
        heading: 'A constrained tool loop',
        blocks: [
          { type: 'list', items: ['Read customer-scoped orders and order details.', 'Check an existing refund status before creating another case.', 'Retrieve policy text for explanation.', 'Invoke the deterministic evaluator to record the verdict.', 'Escalate high-impact or ambiguous cases for human review.'] },
          { type: 'p', text: 'Most tools are read-only. Order access and policy evaluation are scoped to the signed-in customer at the data layer, so the prompt is not the security boundary.' },
        ],
      },
      {
        heading: 'Test policies as scenarios',
        blocks: [
          { type: 'p', text: 'The demo seeds 15 customers that exercise standard approval, final sale, high value, damage evidence, expired windows, duplicate refunds, prompt injection, chargebacks, identity mismatch, prorated discounts, subscriptions, gift cards, shipping exclusions, unfulfilled orders, and high return frequency.' },
          { type: 'p', text: 'Each scenario has an expected rule code and disposition. This makes the agent testable as a product workflow rather than only as a set of conversational examples.' },
        ],
      },
      {
        heading: 'Human review needs its own interface',
        blocks: [
          { type: 'p', text: 'The React customer chat is paired with an admin dashboard that exposes policy diagnostics, tool calls, risk flags, and approval controls. Escalation is therefore a designed state, not an apologetic final message.' },
          { type: 'list', items: ['FastAPI and SQLAlchemy host the agent, policy, trace, and admin APIs.', 'Gemini, OpenAI, Anthropic, or a deterministic mock can use the same provider-neutral loop.', 'Nginx keeps the browser on a relative API boundary in the Dockerized application.', 'High-value, disputed, damaged, subscription, and abuse-risk cases require a person.'] },
        ],
      },
      {
        heading: 'The design principle',
        blocks: [
          { type: 'p', text: 'For consequential agents, reliability comes from limiting authority, making state transitions explicit, and logging enough evidence for review. Better prompting helps the conversation. Architecture protects the outcome.' },
        ],
      },
    ],
  },
  {
    slug: 'open-resources-defence-systems',
    title: 'Open resources for defence systems',
    kind: 'research note',
    dek: 'Building a navigable map of open and public tools across unmanned systems, sensing, geospatial intelligence, communications, simulation, and command-and-control.',
    accent: 'cobalt',
    tags: [{ t: 'systems', a: 'cobalt' }, { t: 'vision', a: 'leaf' }],
    sourceUrl: 'https://github.com/Ibtisam-Mohammad/awesome-defense',
    sourceLabel: 'Awesome Defence repository',
    sections: [
      {
        heading: 'Curation is a systems problem',
        blocks: [
          { type: 'p', text: 'Awesome Defence is a curated index of open-source software, source-available projects, hardware, datasets, papers, standards, and public institutions. Its value is not the number of links. It is whether a reader can move from a mission question to the right technical layer.' },
          { type: 'p', text: 'The scope crosses autopilots, payloads, telemetry, edge AI, navigation, radar, SDR, counter-UAS, geospatial tooling, emergency response, simulation, robotics, and command-and-control. A flat bookmark list would make those relationships invisible.' },
        ],
      },
      {
        heading: 'Use a vocabulary, not vague praise',
        blocks: [
          { type: 'p', text: 'Entries use explicit labels such as OSS, source-available, hardware, dataset, paper, standard, active, archive, dual-use, and fork. These tags answer questions that “awesome” alone cannot: Can I inspect it? Can I build it? Is it maintained? Is it a protocol or an implementation?' },
          { type: 'list', items: ['Start-here entries provide a compact path into major ecosystems.', 'Domain sections preserve operational context instead of grouping only by programming language.', 'Government and research hubs expose durable source organizations.', 'Archive and fork labels preserve useful history without implying current maintenance.'] },
        ],
      },
      {
        heading: 'Map interfaces between domains',
        blocks: [
          { type: 'p', text: 'Many important systems live between categories: a drone payload depends on power, telemetry, onboard compute, geolocation, storage, and a ground interface. A sensing pipeline may connect RF or imagery to tracking, fusion, and a shared operational picture.' },
          { type: 'p', text: 'The taxonomy therefore works as an architecture map. It helps reveal where open standards make components interoperable and where a project is only one part of a larger system.' },
        ],
      },
      {
        heading: 'Maintenance and responsibility',
        blocks: [
          { type: 'list', items: ['Validate link shape and formatting in CI.', 'Prefer primary repositories and official organizations.', 'Distinguish open-source licensing from merely visible source.', 'Describe dual-use resources precisely without overstating capability.', 'Accept contributions through a reviewable, consistent format.'] },
          { type: 'p', text: 'The collection includes defence and dual-use technology. Clear provenance, licensing, lawful use, and responsible context are part of technical quality, not an appendix to it.' },
        ],
      },
    ],
  },
  {
    slug: 'multimodal-emotion-recognition',
    title: 'Multimodal emotion recognition',
    kind: 'project note',
    dek: 'Combining facial-expression signals with speech transcription and sentence sentiment on a shared timeline for audience-reaction analysis.',
    accent: 'teal',
    tags: [{ t: 'speech', a: 'teal' }, { t: 'vision', a: 'leaf' }],
    sourceUrl: 'https://github.com/Ibtisam-Mohammad/Emotion-Detection',
    sourceLabel: 'Emotion analysis repository',
    sections: [
      {
        heading: 'One video, two imperfect views',
        blocks: [
          { type: 'p', text: 'EDAA was built to summarize audience reactions for a speaker. It uses facial expressions from video and contextual sentiment from speech because either modality alone can be misleading.' },
          { type: 'p', text: 'The system does not infer an inner emotional truth. It aggregates model outputs over time to create a reviewable report. That distinction matters for both evaluation and responsible use.' },
        ],
      },
      {
        heading: 'Split, process, realign',
        blocks: [
          { type: 'list', items: ['Decode an uploaded video and divide audio and video into ten-second intervals.', 'Transcribe audio with a Whisper-based ASR service.', 'Classify transcript sentiment with Sentence-BERT.', 'Detect faces and estimate expression classes with the vision service.', 'Store interval results in Google Cloud Storage and combine them for visualization.'] },
          { type: 'p', text: 'Every output carries start and stop times. Those timestamps are the join key between modalities and the frontend plots; without temporal alignment, multimodal results become two unrelated summaries.' },
        ],
      },
      {
        heading: 'A service per expensive concern',
        blocks: [
          { type: 'p', text: 'The prototype separated preprocessing, ASR, sentence classification, and visual inference into containers, with a web frontend and API boundary. This made model dependencies independently deployable and allowed intermediate results to be inspected.' },
          { type: 'code', language: 'json', code: '{\n  "10_20": {\n    "sentence": "...",\n    "prediction": "neutral",\n    "start": 10,\n    "stop": 20\n  }\n}' },
        ],
      },
      {
        heading: 'Where the uncertainty lives',
        blocks: [
          { type: 'list', items: ['Facial expression is not equivalent to emotion, especially across people and cultures.', 'Speech recognition errors propagate into sentiment classification.', 'Ten-second windows trade temporal precision for simpler aggregation.', 'Audience composition and camera visibility can bias the visual counts.', 'A useful report should expose modality-level evidence and disagreement.'] },
          { type: 'p', text: 'The strongest next step would be an evaluation set labelled at the same temporal resolution, with separate metrics for transcription, text sentiment, facial expression, alignment, and the final report.' },
        ],
      },
      {
        heading: 'What carried forward',
        blocks: [
          { type: 'p', text: 'This project made the production shape of multimodal ML concrete: independent models are the easy part; synchronization, intermediate contracts, storage, and honest interpretation determine whether the combined system is useful.' },
        ],
      },
    ],
  },
];

export function noteBySlug(slug: string) {
  return notes.find((note) => note.slug === slug);
}
