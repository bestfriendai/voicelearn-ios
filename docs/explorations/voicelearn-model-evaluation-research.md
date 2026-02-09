# VoiceLearn Model Evaluation Infrastructure
## Research & Recommendations for Automated Model Benchmarking

*Prepared February 2026*

---

## Executive Summary

This document covers three evaluation domains critical to VoiceLearn: **LLM evaluation** (both on-device and server-side), **speech-to-text (STT) evaluation**, and **text-to-speech (TTS) evaluation**. The good news: there is substantial off-the-shelf tooling available in all three areas — much of it open source, automatable, and designed for exactly this kind of ongoing model selection workflow. The even better news: education-specific LLM benchmarks have emerged very recently (January 2026) that align remarkably well with VoiceLearn's needs.

The recommended strategy is a **three-layer evaluation stack**:

1. **EleutherAI's lm-evaluation-harness** as the core LLM benchmarking engine, extended with education-specific task sets
2. **Hugging Face Open ASR Leaderboard framework** + **Picovoice STT Benchmark** for speech-to-text
3. **UTMOS/WVMOS automated MOS scoring** + **custom pronunciation test sets** for text-to-speech

All three can be orchestrated through CI/CD pipelines triggered when new models are released.

---

## Part 1: LLM Evaluation

### 1.1 The Foundation: EleutherAI lm-evaluation-harness

**GitHub:** github.com/EleutherAI/lm-evaluation-harness
**License:** MIT
**What it is:** The de facto standard for LLM benchmarking. It's the backend for Hugging Face's Open LLM Leaderboard, used by NVIDIA, Cohere, BigScience, and dozens of other organizations. It includes 60+ standard academic benchmarks with hundreds of subtasks.

**Why it's the right base for VoiceLearn:**

- Supports local models via HuggingFace Transformers, GGUF via llama.cpp, and vLLM
- Supports quantized models (GPTQ, AWQ) — critical for on-device evaluation
- Supports OpenAI-compatible API endpoints — so you can benchmark against a cloud reference model
- Custom tasks definable via YAML — this is how you add education-specific tests
- CLI-driven, fully automatable, outputs JSON results
- Active development with regular updates

**Key benchmarks already included that map to educational capability:**

| Benchmark | What It Tests | Educational Relevance |
|-----------|--------------|----------------------|
| MMLU (57 subjects) | Knowledge across elementary to professional levels | Direct grade-level mapping — subjects span high school to graduate |
| MMLU-Pro | Harder reasoning-focused version, 10 options instead of 4 | Better discrimination for advanced models |
| ARC (AI2 Reasoning Challenge) | Complex science questions requiring logical reasoning | Science education capability |
| HellaSwag | Common sense and sentence completion | Conversational coherence |
| TruthfulQA | Factual accuracy and avoiding hallucination | Critical for education — can't teach wrong things |
| GSM8K | Grade school math word problems | Math tutoring baseline |
| MATH | Competition-level mathematics | Upper-level math capability |
| HumanEval | Code generation and problem solving | CS education |
| IFEval | Instruction following | Ability to follow educational prompts |

**Running it is straightforward:**

```bash
# Evaluate a local model on education-relevant benchmarks
lm_eval --model hf \
  --model_args pretrained=microsoft/phi-4,dtype=float16 \
  --tasks mmlu,arc_challenge,truthfulqa,gsm8k \
  --device cuda:0 \
  --batch_size 8 \
  --output_path ./results/phi4

# Evaluate a quantized on-device candidate
lm_eval --model hf \
  --model_args pretrained=Qwen/Qwen2.5-1.5B-Instruct,dtype=float16 \
  --tasks mmlu,arc_easy,arc_challenge,truthfulqa \
  --device cuda:0

# Benchmark against an API model as reference
lm_eval --model local-completions \
  --model_args model=gpt-4,base_url=https://api.openai.com/v1 \
  --tasks mmlu
```

### 1.2 Education-Specific Benchmarks (The Missing Piece)

Three very recent benchmarks address education directly:

**OpenLearnLM Benchmark (January 2026)**
- arxiv.org/abs/2601.13882
- The most comprehensive education-specific LLM benchmark available
- 124K+ items evaluating Knowledge, Skills, and Attitude
- Uses Bloom's taxonomy for difficulty levels
- Tests across: curriculum knowledge, pedagogical understanding, adaptive explanation, feedback generation, active learning support, and alignment/deception resistance
- Has already evaluated Claude Opus 4.5, GPT-4, Grok, and other frontier models
- Open framework — can be adapted for VoiceLearn-specific scenarios

**TutorBench (October 2025)**
- arxiv.org/abs/2510.02663
- 1,490 expert-curated samples focused on high school and AP-level STEM
- Tests three core tutoring skills: adaptive explanations, actionable feedback, and hint generation
- Uses rubric-based evaluation with LLM-judge scoring
- Key finding: no frontier LLM scores above 56%, meaning this benchmark has headroom
- Available on Hugging Face: tutorbench/tutorbench

**MathTutorBench (2025)**
- eth-lre.github.io/mathtutorbench
- Focused specifically on mathematical tutoring capability
- Tests open-ended pedagogical capabilities across 7 concrete tasks
- Evaluates three high-level teacher skills

### 1.3 Building the "Grade Level" Rating System

MMLU already provides a natural grade-level proxy because its 57 subjects span from elementary to professional/graduate level. Here's a practical approach:

**Tier 1: Elementary/Middle School (Grades 5-8)**
- MMLU elementary mathematics, formal logic
- ARC Easy set
- GSM8K (grade school math)
- Custom: simple science vocabulary, reading comprehension

**Tier 2: High School (Grades 9-12)**
- MMLU high school subjects (biology, chemistry, physics, math, history, etc.)
- ARC Challenge set
- TutorBench AP-level scenarios

**Tier 3: Undergraduate**
- MMLU college-level subjects
- MATH benchmark
- MMLU-Pro

**Tier 4: Graduate/PhD**
- MMLU professional subjects (medicine, law, engineering)
- GPQA (Graduate-level Google-Proof Q&A)
- Humanity's Last Exam (cutting-edge difficulty)
- Custom: domain-specific expert conversation scenarios

A model earns a "tier rating" based on achieving a threshold (e.g., >70% accuracy) at each level. This gives you a simple grid: "Model X handles Tier 1-2 comfortably, struggles at Tier 3, fails Tier 4."

### 1.4 On-Device vs. Server-Side Evaluation

The evaluation harness handles both, but the metrics differ:

**For on-device candidates (1-3B parameter models):**

- **Quality metrics:** Run through lm-evaluation-harness as above
- **Performance metrics:** Use ELIB (Edge LLM Inference Benchmark) or ollamabench for tokens/second, memory usage, power consumption
- **MobileAIBench** (openreview.net/forum?id=EEbRrNsiiD) — specifically designed for mobile LLM evaluation, includes an iOS app for on-device latency measurement
- Key models to track: Qwen 2.5 (1.5B), SmolLM2 (1.7B), Gemma 3 (1B), Llama 3.2 (1B/3B), Phi-4 Mini

**For server-side candidates (7-70B+ parameter models):**

- Full lm-evaluation-harness suite including education benchmarks
- Conversational quality assessment via TutorBench and OpenLearnLM
- Context window stress tests (long educational dialogues)
- Key models to track: Llama 3.x, Qwen 2.5, Mistral, DeepSeek, Phi-4

### 1.5 Alternative/Complementary LLM Eval Frameworks

| Framework | Best For | Notes |
|-----------|----------|-------|
| **DeepEval** (github.com/confident-ai/deepeval) | App-level testing with pytest integration | Has built-in MMLU runner, treats evals as unit tests, great for CI/CD |
| **OpenAI Evals** (github.com/openai/evals) | Custom eval creation | Good template system, but OpenAI-centric |
| **Google LMEval** | Cross-provider benchmarking | Uses LiteLLM for provider abstraction, good multimodal support |
| **Opik** (by Comet) | Agent workflow testing | End-to-end testing for complex AI pipelines |
| **Arize Phoenix** | Production monitoring | Self-hosted observability for deployed models |

### 1.6 Recommended LLM Evaluation Architecture

```
┌──────────────────────────────────────────────────┐
│           VoiceLearn Model Eval Pipeline          │
├──────────────────────────────────────────────────┤
│                                                  │
│  Trigger: New model release / scheduled weekly   │
│                                                  │
│  ┌─────────────┐    ┌──────────────────────┐    │
│  │ On-Device    │    │ Server-Side          │    │
│  │ Candidates   │    │ Candidates           │    │
│  │ (1-3B)       │    │ (7B+)                │    │
│  └──────┬──────┘    └──────────┬───────────┘    │
│         │                      │                 │
│         ▼                      ▼                 │
│  ┌──────────────────────────────────────────┐   │
│  │  lm-evaluation-harness                    │   │
│  │  - MMLU (tiered by grade level)           │   │
│  │  - ARC, TruthfulQA, GSM8K                │   │
│  │  - TutorBench scenarios                   │   │
│  │  - OpenLearnLM subset                     │   │
│  │  - Custom VoiceLearn conversation tests    │   │
│  └──────────────────────────────────────────┘   │
│         │                      │                 │
│         ▼                      ▼                 │
│  ┌─────────────┐    ┌──────────────────────┐    │
│  │ On-Device    │    │ Reference Benchmark   │    │
│  │ Performance  │    │ (API model like       │    │
│  │ - ollamabench│    │  Claude/GPT-4 as      │    │
│  │ - MobileAI   │    │  quality ceiling)     │    │
│  │   Bench      │    │                       │    │
│  └──────┬──────┘    └──────────┬───────────┘    │
│         │                      │                 │
│         ▼                      ▼                 │
│  ┌──────────────────────────────────────────┐   │
│  │  Results Dashboard                        │   │
│  │  - Grade level capability matrix          │   │
│  │  - Quality vs. performance scatter        │   │
│  │  - Delta from reference model             │   │
│  │  - Historical trend per model family      │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## Part 2: Speech-to-Text (STT) Evaluation

### 2.1 The Foundation: Hugging Face Open ASR Leaderboard

**GitHub:** github.com/huggingface/open_asr_leaderboard
**Leaderboard:** huggingface.co/spaces/hf-audio/open_asr_leaderboard

This is the gold standard for STT evaluation. It currently benchmarks 60+ models from 18 organizations across 11 datasets. All evaluation code is open source and designed to be extended.

**What it measures:**

- **Word Error Rate (WER):** The primary accuracy metric — ratio of errors to total words
- **Inverse Real-Time Factor (RTFx):** Throughput — how many seconds of audio processed per second of compute. RTFx of 100 means 100 seconds of audio per second of compute
- **Tracks:** English, Multilingual (DE/FR/IT/ES/PT), Long-form (30+ seconds)

**Datasets used:**

| Dataset | Domain | Why It Matters |
|---------|--------|---------------|
| LibriSpeech (clean/other) | Audiobook narration | Baseline accuracy benchmark |
| Common Voice | Crowdsourced, diverse accents | Accent robustness |
| VoxPopuli | European Parliament | Formal speech |
| TED-LIUM | TED talks | Educational/lecture-style speech |
| GigaSpeech | Multi-domain (podcast, YouTube) | Real-world conditions |
| SPGISpeech | Financial earnings calls | Domain-specific terminology |
| Earnings22 | Financial meetings | Domain jargon accuracy |
| AMI | Meeting recordings | Multi-speaker, noisy |

**Running evaluations:**

```bash
git clone https://github.com/huggingface/open_asr_leaderboard
cd open_asr_leaderboard/transformers

# Evaluate Whisper Large V3 Turbo
bash whisper_large_v3_turbo.sh

# Or run the generic eval script for any model
python run_eval.py \
  --model_id openai/whisper-large-v3-turbo \
  --dataset librispeech_asr \
  --split test.clean \
  --batch_size 64 \
  --device cuda:0
```

### 2.2 Picovoice STT Benchmark

**GitHub:** github.com/Picovoice/speech-to-text-benchmark

A complementary framework that adds:

- **Core-Hour metric:** CPU hours required to process 1 hour of audio (computational efficiency)
- **Word Emission Latency:** For streaming engines — delay from word spoken to transcription emitted
- **Model Size:** Aggregate size in MB (important for on-device)
- Supports both cloud APIs (Amazon, Azure, Google, IBM) and local engines
- Easy to add custom datasets (any WAV/FLAC files)

This is particularly valuable for VoiceLearn because it directly measures on-device feasibility.

### 2.3 Key STT Metrics for VoiceLearn

| Metric | What It Measures | VoiceLearn Priority |
|--------|-----------------|-------------------|
| WER | Transcription accuracy | **Critical** — wrong words = wrong understanding |
| Domain WER | Accuracy on specialized vocabulary | **Critical** — educational terminology |
| Latency (TTFB) | Time to first transcription byte | **High** — conversational responsiveness |
| RTFx | Throughput | **Medium** — matters for server-side |
| Model Size | Memory/storage footprint | **High** for on-device |

### 2.4 Custom Domain Testing for Education

The standard benchmarks won't capture educational domain accuracy. You'll want to create custom test sets:

**Recommended approach:**

1. **Build a domain vocabulary test set:** Record or synthesize audio of educational terminology across subjects — scientific terms, mathematical language, historical names, literary references
2. **Create grade-tiered test sets:** 
   - Elementary: basic scientific words (photosynthesis, ecosystem)
   - High school: more complex (mitochondria, stoichiometry, logarithm)
   - College: specialized (epigenetics, eigenvalue, Keynesian)
   - Graduate: highly technical (angiogenesis, Lagrangian mechanics)
3. **Run through Picovoice benchmark framework** with custom WAV files
4. **Measure domain-specific WER** separately from general WER

### 2.5 Current Top Open-Source STT Models to Track

| Model | Parameters | WER (LibriSpeech clean) | RTFx | Languages | Notes |
|-------|-----------|------------------------|------|-----------|-------|
| Canary Qwen 2.5B | 2.5B | ~5.6% | 418x | Multi | Top of Open ASR Leaderboard |
| Whisper Large V3 Turbo | 809M | ~5-7% | Fast | 100+ | Best multilingual coverage |
| NVIDIA Parakeet TDT v3 | 0.6B-1.1B | Very low | Very high | 25 | Speed + accuracy balance |
| Moonshine | 27M-240M | Competitive | CPU-friendly | EN | Designed for on-device/edge |
| Granite Speech 3.3 | 8B | ~5.85% | 31x | 4+ | IBM enterprise model |

**For on-device specifically:** Moonshine (27M variant), Whisper Tiny/Small, and Vosk are the best candidates given their small footprint.

---

## Part 3: Text-to-Speech (TTS) Evaluation

### 3.1 The Challenge

TTS evaluation is the hardest of the three because quality is inherently subjective. "Can I listen to this for hours?" is a human judgment. However, automated metrics have improved significantly.

### 3.2 Automated Quality Metrics

**UTMOS (UTokyo-SaruLab MOS Prediction)**
- Open source MOS (Mean Opinion Score) predictor
- Predicts human quality ratings from audio features
- Scores on 1-5 scale (5 = highest quality)
- Widely used in TTS benchmarks

**WVMOS (Wav2Vec MOS)**
- GitHub: github.com/AndreevP/wvmos
- Another automated MOS predictor
- Best practice: average UTMOS and WVMOS for more robust scores

**WER on synthesized speech:**
- Generate speech → run STT → compare to input text
- Measures intelligibility and pronunciation accuracy
- A model with WER < 2% is producing highly intelligible speech

**Practical evaluation pipeline:**

```python
# Pseudocode for automated TTS evaluation
for model in tts_models:
    for sentence in test_sentences:
        # Generate audio
        audio = model.synthesize(sentence)
        
        # Automated MOS (naturalness)
        utmos_score = utmos.predict(audio)
        wvmos_score = wvmos.predict(audio)
        avg_mos = (utmos_score + wvmos_score) / 2
        
        # Intelligibility (WER)
        transcription = whisper.transcribe(audio)
        wer = calculate_wer(sentence, transcription)
        
        # Latency
        ttfb = measure_time_to_first_byte(model, sentence)
        total_time = measure_total_synthesis_time(model, sentence)
        
        record_results(model, sentence, avg_mos, wer, ttfb, total_time)
```

### 3.3 Pronunciation-Specific Evaluation

This is where VoiceLearn has unique requirements. Standard benchmarks don't test:

- **Difficult educational terms:** Can it say "stoichiometry" or "Pythagorean" correctly?
- **Foreign names and places:** Historical figures, geographical terms
- **IPA/phonetic guidance compliance:** When given pronunciation hints, does it follow them?

**Recommended custom test approach:**

1. **Build a pronunciation challenge set:**
   - 200+ difficult educational words across subjects
   - Include common mispronunciation traps
   - Include foreign-origin terms (Latin, Greek, French scientific terms)

2. **Test IPA compliance:**
   - Provide IPA notation alongside difficult words
   - Measure whether the model adjusts pronunciation
   - Score: % of words pronounced within acceptable bounds

3. **Automated pronunciation scoring:**
   - Use forced alignment tools (Montreal Forced Aligner, Gentle)
   - Compare phoneme sequences of generated speech to expected pronunciation
   - Calculate Phoneme Error Rate (PER) for domain vocabulary

### 3.4 Expressiveness and "Listenability" Metrics

For extended listening (VoiceLearn's 60-90+ minute sessions):

- **Prosody variation:** Measure pitch range, speaking rate variation, and pause patterns. Monotonous speech = listener fatigue
- **Emotion consistency:** Can it maintain appropriate affect across a long session?
- **UTMOS + custom fatigue proxy:** Higher UTMOS generally correlates with less listening fatigue

**TTS Arena (Hugging Face):**
- huggingface.co/spaces/TTS-AGI/TTS-Arena
- Crowdsourced human preference ratings using Elo-style ranking
- Useful as a reference but not automatable for your pipeline

### 3.5 Current Top Open-Source TTS Models to Track

| Model | Parameters | MOS | Latency | Languages | Key Strength |
|-------|-----------|-----|---------|-----------|-------------|
| Chatterbox / Chatterbox-Turbo | 0.5B | High | Very fast (1-step) | EN | Emotion control, naturalness, MIT license |
| F5-TTS | Medium | Very high | Medium | Multi | Best naturalness + intelligibility balance |
| Kokoro-82M | 82M | Good | Sub-0.3s | EN/Multi | Fastest, great for on-device |
| XTTS-v2 | Medium | High | Medium | 20+ | Best multilingual option |
| CosyVoice2-0.5B | 0.5B | 5.53 | 150ms | Multi | Low latency + quality |
| Higgs Audio V2 | ~3B | Very high | Medium | Multi | Top trending, best emotional range |
| NeuTTS Air | 0.5B | Near-human | Real-time | EN | First on-device super-realistic TTS, runs on phone |
| Orpheus | 150M-3B | High | Variable | Multi | Multiple sizes for different deployment targets |

**For on-device specifically:** Kokoro-82M, NeuTTS Air (0.5B, GGUF format), and Orpheus-150M are the leading candidates.

### 3.6 Existing TTS Benchmarking Frameworks

**Artificial Analysis TTS Benchmark** (artificialanalysis.ai/text-to-speech)
- Holistic quality + performance evaluation
- Tests commercial and open-source models
- Methodology is documented but the framework isn't fully open source

**The responsive TTS benchmark paper (Computers 2025)**
- Tests 13 open-source TTS models
- Measures latency distribution, tail latency (P90), and intelligibility
- Reproducible pipeline — code available
- Good model for your own benchmark design

**Inferless TTS Comparison**
- Tested 12 models across latency at different input lengths (5 to 200 words)
- Measured naturalness, intelligibility, controllability
- Publicly available results and methodology

---

## Part 4: Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

1. **Set up lm-evaluation-harness** on a GPU server
2. **Define the tiered MMLU benchmark set** (elementary through graduate)
3. **Clone the Open ASR Leaderboard repo** and run against top 5 STT models
4. **Set up UTMOS + WVMOS** automated scoring for TTS
5. **Establish baseline** by benchmarking current VoiceLearn model choices

### Phase 2: Custom Tests (Week 3-4)

1. **Build educational vocabulary test sets** for STT (record/synthesize domain terms)
2. **Build pronunciation challenge sets** for TTS
3. **Create custom YAML task definitions** for lm-evaluation-harness targeting educational conversation
4. **Integrate TutorBench and OpenLearnLM** subsets into the LLM eval pipeline

### Phase 3: Automation (Week 5-6)

1. **CI/CD pipeline:** GitHub Actions or similar, triggered on:
   - New model release notifications (HuggingFace webhook or RSS)
   - Scheduled weekly/bi-weekly runs
2. **Results dashboard:** Simple web page or spreadsheet auto-updated with:
   - Model comparison grids per category (LLM tier, STT WER, TTS MOS)
   - Historical trends
   - Recommended picks per deployment target
3. **Alerting:** Notify when a new model significantly outperforms current picks

### Phase 4: Refinement (Ongoing)

1. **A/B test models** with real VoiceLearn users for subjective validation
2. **Refine grade-level thresholds** based on actual tutoring session quality
3. **Expand multilingual testing** as VoiceLearn adds language support
4. **Track on-device capability curve** — as you noted, this will change fast

---

## Key Resources

### LLM Evaluation
- **lm-evaluation-harness:** github.com/EleutherAI/lm-evaluation-harness
- **DeepEval:** github.com/confident-ai/deepeval
- **OpenLearnLM Benchmark:** arxiv.org/abs/2601.13882
- **TutorBench:** arxiv.org/abs/2510.02663
- **MathTutorBench:** eth-lre.github.io/mathtutorbench
- **MobileAIBench:** arxiv.org/abs/2406.10290
- **ELIB (Edge LLM Benchmark):** arxiv.org/abs/2508.11269
- **ollamabench:** pypi.org/project/ollamabench
- **HuggingFace Open LLM Leaderboard:** huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard
- **LLM Evaluation Resources Compendium:** alopatenko.github.io/LLMEvaluation

### STT Evaluation
- **Open ASR Leaderboard:** huggingface.co/spaces/hf-audio/open_asr_leaderboard
- **Open ASR Leaderboard Code:** github.com/huggingface/open_asr_leaderboard
- **Picovoice STT Benchmark:** github.com/Picovoice/speech-to-text-benchmark
- **SpeechBrain:** speechbrain.github.io (toolkit with built-in evaluation)

### TTS Evaluation
- **UTMOS:** github.com/sarulab-speech/UTMOS22
- **WVMOS:** github.com/AndreevP/wvmos
- **TTS Arena:** huggingface.co/spaces/TTS-AGI/TTS-Arena
- **Inferless TTS Comparison:** inferless.com/learn/comparing-different-text-to-speech---tts--models-part-2
- **StructTTSEval (Expressiveness Benchmark):** arxiv.org/abs/2506.16381

### On-Device Inference
- **llama.cpp:** github.com/ggerganov/llama.cpp (core local inference)
- **MLX:** ml-explore.github.io/mlx (Apple Silicon optimized)
- **MLC-LLM:** mlc.ai/mlc-llm (mobile deployment, iOS/Android)
- **Ollama:** ollama.ai (easiest local model management)

---

## Bottom Line

You're right that this isn't a small thing — but the infrastructure to do it well already exists. The core insight is that **you don't need to build evaluation tools from scratch.** EleutherAI's harness, the Open ASR Leaderboard, and UTMOS/WVMOS give you 80% of what you need off the shelf. The remaining 20% is custom educational test sets, which is where VoiceLearn's domain expertise adds unique value.

And you're absolutely right about the on-device trajectory. When a 3B parameter model today can handle high school-level tutoring, and models are getting more capable at smaller sizes every quarter, the crossover point where on-device handles undergraduate-level conversations is not far off. Having the evaluation infrastructure in place now means you'll see that moment as soon as it arrives.
