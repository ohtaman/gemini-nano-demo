# Chrome Built-in Multimodal AI Demos (Gemini Nano)

This repository contains interactive web demos utilizing Chrome's experimental **Multimodal Prompt API** to run Gemini Nano locally on your device.

## 🚀 Live Demos (GitHub Pages)

Once GitHub Pages is enabled on this repository, you can view the live demos here:
- **Screen Analyzer**: [https://ohtaman.github.io/gemini-nano-demo/](https://ohtaman.github.io/gemini-nano-demo/)
- **Privacy Upload Checker**: [https://ohtaman.github.io/gemini-nano-demo/privacy_check.html](https://ohtaman.github.io/gemini-nano-demo/privacy_check.html)

---

## 🛠️ Chrome Configuration & Prerequisites

Since these demos run Gemini Nano locally inside your browser, you must use **Google Chrome (version 148 or higher)** and configure the following flags:

1. **Enable On-Device Model Flags**:
   * Open `chrome://flags` in your browser.
   * Enable **`#optimization-guide-on-device-model`** (set to **Enabled BypassRamRequirement** or **Enabled**).
   * Enable **`#prompt-api-for-gemini-nano`** (set to **Enabled**).
   * Relaunch Chrome.

2. **Download the AI Model**:
   * Open `chrome://components`.
   * Locate **`Optimization Guide On Device Model`**.
   * Click **"Check for update"** and wait for the download status to reach 100% / Update Complete (this downloads the 3GB Gemini Nano model).

---

## 📂 Demos Included

### 1. Screen Capture Analyzer (`index.html`)
An automated screen monitoring tool that uses the browser's window capture stream. It periodically takes screenshots, downscales them, and feeds them into the local Gemini Nano model to analyze your active workspace, detect coding errors/warnings, and output helpful explanations in Japanese.
* **Optimized Performance**: Pauses capture intervals during analysis to avoid WebGPU texture resource contention, keeping inference times under a few seconds.

### 2. Privacy Upload Redaction Checker (`privacy_check.html`)
A single-file drag-and-drop uploader tool designed to scan documents, shipping labels, and workspace photos for sensitive personal information (PII) before uploading them to the web.
* Includes realistic preloaded test assets:
  * `sample_delivery_box.png`: A cardboard box shipping slip with mock PII.
  * `sample_subtle_workspace.png`: A cluttered desk where a coffee mug partially covers a yellow memo note containing mock names and phone numbers.
