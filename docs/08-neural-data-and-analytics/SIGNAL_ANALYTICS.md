# Neural Data & Signal Analytics Specification (Module 11) — CORTEXIA

**Document ID:** `DOC-ANA-001`  
**Module:** `MOD-11` (Neural Data & Signal Analytics)  
**Environment:** `ENV-03` (Analytics Environment)  
**Status:** Authoritative (Phase 0)  
**Last Updated:** 2026-11-16

---

## 1. Purpose and Scope

This document defines the mathematical formulations, input/output contracts, assumptions, limitations, and causal-inference safeguards for all **26 scientific analysis methods** in **Module 11 — Neural Data & Signal Analytics**, spanning neural signal processing, spike train analytics, network science, and statistical inference.

> [!CAUTION]
> **Mandatory Interpretive Safeguards:**
> 1. **Correlation $\neq$ Causation:** Every correlation, coherence, PLV, regression, and functional connectivity view MUST display an explicit interpretive notice that statistical dependency does not prove direct synaptic drive or causal direction.
> 2. **Provenance & Units Required:** Raw and imported signals must declare `samplingRateHz`, physical `unit` (`µV`, `mV`, `pA`, `z-score`), channel montage, and provenance (`EMPIRICAL_OPEN_DATASET` vs `SYNTHETIC_SIMULATION`).

---

## 2. Neural Signal Processing Suite (`ANALYTIC-001` – `ANALYTIC-008`)

### 2.1 Digital Filtering & Preprocessing (`ANALYTIC-001`, `ANALYTIC-002`)
- **Zero-Phase IIR Butterworth Filter (`ANALYTIC-001`, `EQ-ANA-BUTTERWORTH`):** 2nd/4th-order Biquad cascade applied forward and backward (`filtfilt`) to eliminate phase distortion:
  $$|H(j\omega)|^2 = \frac{1}{1 + (\omega / \omega_c)^{2n}}$$
  Supports Low-Pass, High-Pass (`e.g. 0.5 Hz` drift removal), Band-Pass, and `50/60 Hz` Line-Noise Notch filtering.
- **Windowed-Sinc FIR Filter (`ANALYTIC-002`, `EQ-ANA-FIR`):** Linear-phase causal/symmetric FIR convolution $y[n] = \sum_{k=0}^{M} b_k x[n - k]$ with Hamming/Hann windowing.
- **Artifact & Preprocessing Pipeline (`ANALYTIC-008`):** Common Average Reference (`CAR`), baseline z-score/demean normalization, threshold amplitude artifact rejection (`|V| > 150 µV`), and ocular/EMG artifact spectral educational demonstrations.

### 2.2 Spectral & Time-Frequency Decomposition (`ANALYTIC-003` – `ANALYTIC-007`)
1. **Discrete Fourier Transform (`DFT` / Radix-2 `FFT`, `ANALYTIC-003`, `EQ-ANA-DFT`):**
   $$X[k] = \sum_{n=0}^{N-1} w[n]\,x[n]\,\exp\!\left(-j\frac{2\pi k n}{N}\right), \qquad f_k = \frac{k f_s}{N}, \quad k = 0, \dots, \lfloor N/2 \rfloor$$
   Assumes signal stationarity over window $N / f_s$ and respects Nyquist limit $f_{\text{Nyq}} = f_s / 2$.
2. **Welch Modified Periodogram PSD (`ANALYTIC-004`, `EQ-ANA-WELCH`, `REF-WELCH-1967`):**
   Splits signal into $K$ overlapping segments of length $L$ with window $w[n]$ ($U = \frac{1}{L}\sum_{n=0}^{L-1} w^2[n]$):
   $$\hat{P}_{xx}(f_k) = \frac{1}{K f_s L U} \sum_{m=1}^{K} \left|\sum_{n=0}^{L-1} w[n]\,x_m[n]\,e^{-j 2\pi k n / L}\right|^2 \quad [\mu\text{V}^2/\text{Hz}]$$
   Includes Canonical Band Power integration ($\delta: 0.5\text{–}4\text{ Hz}$, $\theta: 4\text{–}8\text{ Hz}$, $\alpha: 8\text{–}12\text{ Hz}$, $\beta: 13\text{–}30\text{ Hz}$, $\gamma: 30\text{–}80\text{ Hz}$).
3. **Short-Time Fourier Transform (`STFT`) Spectrogram (`ANALYTIC-005`, `EQ-ANA-STFT`):**
   $$\text{STFT}\{x\}(m, \omega) = \sum_{n} x[n]\,w[n - mH]\,e^{-j\omega n}$$
   Displays time–frequency uncertainty trade-off ($\Delta t \cdot \Delta f \ge \frac{1}{4\pi}$).
4. **Complex Morlet Wavelet Time-Frequency Transform (`ANALYTIC-006`, `EQ-ANA-MORLET`, `REF-TALLON-BAUDRY-1996`):**
   $$\psi(t, f_0) = A \exp\!\left(-\frac{t^2}{2\sigma_t^2}\right) \exp(j 2\pi f_0 t), \qquad \sigma_f = \frac{f_0}{n_{\text{cycles}}}, \quad \sigma_t = \frac{1}{2\pi \sigma_f}$$
   Default $n_{\text{cycles}} = 7$; outputs instantaneous power $|W(t, f_0)|^2$ and phase $\arg W(t, f_0)$ with Cone-of-Influence (`COI`) edge-effect boundary overlay.
5. **Event-Related Potential (`ERP`) Trial Averaging (`ANALYTIC-007`, `EQ-ANA-ERP`):**
   $$\bar{v}_{\text{ERP}}(\tau) = \frac{1}{M}\sum_{m=1}^{M} \left(v_m(t_m^{\text{trig}} + \tau) - \mu_{\text{base}, m}\right), \qquad \text{SEM}(\tau) = \frac{s(\tau)}{\sqrt{M}}$$
   Extracts phase-locked evoked activity while attenuating non-phase-locked background noise by $1/\sqrt{M}$.

---

## 3. Spike Train Analytics (`ANALYTIC-009` – `ANALYTIC-015`)

1. **Spike Raster & Population Rate (`ANALYTIC-009`, `EQ-ANA-FIRING-RATE`):**
   Mean firing rate $r_i = N_{\text{sp}, i} / T$ and Gaussian-smoothed population rate $R(t) = \frac{1}{N}\sum_{i,f} K_\sigma(t - t_i^{(f)})$.
2. **Inter-Spike Interval (`ISI`) Histogram & Coefficient of Variation (`ANALYTIC-010`, `EQ-ANA-CV-ISI`):**
   $$\Delta t_k = t^{(k+1)} - t^{(k)}, \qquad CV_{\text{ISI}} = \frac{\sigma_{\text{ISI}}}{\mu_{\text{ISI}}}, \qquad CV_2 = \frac{2|\Delta t_{k+1} - \Delta t_k|}{\Delta t_{k+1} + \Delta t_k}$$
   ($CV_{\text{ISI}} = 0$ periodic pacemaker; $CV_{\text{ISI}} = 1$ homogeneous Poisson process).
3. **Fano Factor Spike-Count Variability (`ANALYTIC-011`, `EQ-ANA-FANO`):**
   $$F(W) = \frac{\text{Var}(N_{\text{sp}}(W))}{\mathbb{E}[N_{\text{sp}}(W)]}$$
4. **Peri-Stimulus Time Histogram (`PSTH`, `ANALYTIC-012`, `EQ-ANA-PSTH`):**
   $$r_{\text{PSTH}}(k\Delta_{\text{bin}}) = \frac{n_k}{M_{\text{trials}}\,\Delta_{\text{bin}}} \quad [\text{Hz}]$$
5. **Spike-Triggered Average (`STA`, `ANALYTIC-013`, `EQ-ANA-STA`, `REF-DAYAN-2001`):**
   $$\text{STA}(\tau) = \frac{1}{N_{\text{sp}}} \sum_{f=1}^{N_{\text{sp}}} s(t^{(f)} - \tau)$$
6. **Spike Train Cross-Correlogram (`CCG`, `ANALYTIC-014`, `EQ-ANA-CCG`):**
   $$C_{ij}(\tau) = \frac{1}{T\sqrt{r_i r_j}} \sum_{f, g} \mathbb{I}\!\left(\tau - \tfrac{\Delta}{2} \le t_i^{(f)} - t_j^{(g)} < \tau + \tfrac{\Delta}{2}\right)$$
7. **Population Synchrony & Phase-Locking (`ANALYTIC-015`, `EQ-ANA-SYNCHRONY`, `EQ-ANA-PLV`, `REF-LACHAUX-1999`):**
   - Golomb–Rinzel voltage/rate synchrony index $\chi = \sqrt{\frac{\sigma_{V_{\text{pop}}}^2}{\frac{1}{N}\sum_i \sigma_{V_i}^2}} \in [0, 1]$.
   - Phase-Locking Value (`PLV`): $\text{PLV}_{xy} = \left|\frac{1}{N_t}\sum_{n=1}^{N_t} e^{j(\phi_x[n] - \phi_y[n])}\right| \in [0, 1]$.
   - Magnitude-Squared Coherence: $C_{xy}(f) = \frac{|P_{xy}(f)|^2}{P_{xx}(f) P_{yy}(f)} \in [0, 1]$.

---

## 4. Network Science Analytics (`ANALYTIC-016` – `ANALYTIC-019`)

Integrates the exact graph equations defined in [NETWORK_MODELS.md](../06-computational-models/NETWORK_MODELS.md):
- `ANALYTIC-016`: Directed/Undirected Degree, In/Out Strength & Density Distribution.
- `ANALYTIC-017`: Node Betweenness Centrality, Clustering Coefficient & Participation Coefficient.
- `ANALYTIC-018`: Characteristic Path Length, Global/Local Efficiency & Small-Worldness $\sigma_{\text{SW}}$ (benchmarked against $M=20$ Maslov–Sneppen degree-preserving null graphs).
- `ANALYTIC-019`: Newman–Girvan Modularity $Q$, Louvain Community Detection & Targeted/Random Lesion Robustness Curves.

---

## 5. Statistical & Computational Inference Tools (`ANALYTIC-020` – `ANALYTIC-026`)

1. **Descriptive & Distribution Statistics (`ANALYTIC-020`):** Mean, SD, SEM, median, IQR, skewness, kurtosis, empirical CDF, Gaussian/Poisson/Exponential/Log-Normal fits.
2. **Parametric & Rank Correlation (`ANALYTIC-021`, `EQ-STAT-PEARSON`, `EQ-STAT-SPEARMAN`):**
   $$r_{xy} = \frac{\sum_{i=1}^n (x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum_{i=1}^n (x_i - \bar{x})^2 \sum_{i=1}^n (y_i - \bar{y})^2}}$$
   Includes mandatory UI banner: *"Correlation measures linear/monotonic association and does NOT establish causal direction."*
3. **Linear / Polynomial Regression & Residual Diagnostics (`ANALYTIC-022`, `EQ-STAT-OLS`):** Ordinary least squares $\hat{\boldsymbol{\beta}} = (\mathbf{X}^\top\mathbf{X})^{-1}\mathbf{X}^\top\mathbf{y}$, $R^2$, adjusted $R^2$, Durbin–Watson lag-1 autocorrelation, and residual Q-Q / homoscedasticity plots.
4. **Nonparametric Bootstrap Confidence Intervals (`ANALYTIC-023`, `EQ-STAT-BOOTSTRAP`, `REF-EFRON-1979`):** Resample $B = 1,000$–$5,000$ replicates with replacement (seeded PRNG) to compute percentile / BCa $95\%$ CIs.
5. **Two-Sample Permutation & Hypothesis Testing with FDR (`ANALYTIC-024`, `EQ-STAT-FDR`, `REF-BENJAMINI-HOCHBERG-1995`):** Welch's $t$-test, Mann–Whitney $U$, exact/Monte-Carlo permutation test, and Benjamini–Hochberg False Discovery Rate (`FDR` $q \le 0.05$) correction across multichannel/multi-edge comparisons.
6. **Parameter Estimation & Local Sensitivity Index (`ANALYTIC-025`):** Grid/Nelder–Mead least-squares curve fitting and normalized sensitivity matrix $S_{p_k}^M$.
7. **Information-Criterion Model Comparison (`ANALYTIC-026`, `EQ-STAT-AIC-BIC`):**
   $$\text{AIC} = 2k - 2\ln(\hat{L}), \qquad \text{BIC} = k\ln(n) - 2\ln(\hat{L})$$

## 6. Acceptance Criteria & Related Documents

- **AC-ANA-001:** All 26 analysis methods are registered in `registries/analysis-methods/analysis-methods.json` with equations, input requirements, edge-case guards, and UCES metric tooltips.
- **Links:** [NETWORK_MODELS.md](../06-computational-models/NETWORK_MODELS.md), [DATASET_CATALOG_AND_SOURCES.md](../11-data-and-research/DATASET_CATALOG_AND_SOURCES.md), [EXPERIMENT_FRAMEWORK_AND_REPRODUCIBILITY.md](../11-data-and-research/EXPERIMENT_FRAMEWORK_AND_REPRODUCIBILITY.md).

## 7. References

- `REF-WELCH-1967`: DOI `10.1109/TAU.1967.1161901`
- `REF-TALLON-BAUDRY-1996`: DOI `10.1523/JNEUROSCI.16-13-04240.1996`
- `REF-LACHAUX-1999`: DOI `10.1002/(SICI)1097-0193(1999)8:4<194::AID-HBM4>3.0.CO;2-C`
- `REF-EFRON-1979`: DOI `10.1214/aos/1176344552`
- `REF-BENJAMINI-HOCHBERG-1995`: DOI `10.1111/j.2517-6161.1995.tb02031.x`
- `REF-RUBINOV-2010`: DOI `10.1016/j.neuroimage.2009.10.003`
