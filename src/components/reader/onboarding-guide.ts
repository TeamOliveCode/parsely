export interface OnboardingStep {
  targetId: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export class OnboardingGuide {
  private shadowRoot: ShadowRoot;
  private currentStep: number = 0;
  private onCompleteCallback: (() => void) | null = null;
  private isActive: boolean = false;

  private steps: OnboardingStep[] = [
    {
      targetId: 'paragraph-container',
      title: 'Focus Reading',
      description: 'Read one paragraph at a time. Use arrow keys (← → ↑ ↓) or click to navigate. Drag text to add notes.',
      position: 'bottom',
    },
    {
      targetId: 'toolbar',
      title: 'Toolbar',
      description: 'Add memos, save bookmarks, and view your library.',
      position: 'bottom',
    },
    {
      targetId: 'bottom-left-controls',
      title: 'Display',
      description: 'Adjust background darkness and font size.',
      position: 'bottom',
    },
    {
      targetId: 'settings-btn',
      title: 'Settings',
      description: 'Change fonts, spacing, and shortcuts.',
      position: 'bottom',
    },
  ];

  constructor(shadowRoot: ShadowRoot) {
    this.shadowRoot = shadowRoot;
  }

  public getStyles(): string {
    return `
      .onboarding-tooltip {
        position: fixed;
        background: #1a1a1a;
        border: 1px solid rgba(0, 255, 159, 0.5);
        border-radius: 12px;
        padding: 16px 20px;
        width: 280px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        z-index: 9999;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
      }
      .onboarding-tooltip.visible {
        opacity: 1;
        pointer-events: auto;
      }
      .tooltip-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }
      .tooltip-step {
        font-size: 0.65rem;
        color: rgba(255, 255, 255, 0.4);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .tooltip-title {
        font-size: 1rem;
        font-weight: 600;
        color: #fff;
        margin-bottom: 8px;
      }
      .tooltip-description {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.65);
        line-height: 1.5;
        margin-bottom: 14px;
      }
      .tooltip-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .tooltip-dots {
        display: flex;
        gap: 6px;
      }
      .tooltip-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        transition: all 0.2s ease;
      }
      .tooltip-dot.active {
        background: #00ff9f;
        transform: scale(1.2);
      }
      .tooltip-dot.completed {
        background: rgba(0, 255, 159, 0.5);
      }
      .tooltip-actions {
        display: flex;
        gap: 10px;
      }
      .tooltip-skip {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.75rem;
        cursor: pointer;
        padding: 6px 10px;
        transition: color 0.2s ease;
      }
      .tooltip-skip:hover {
        color: rgba(255, 255, 255, 0.7);
      }
      .tooltip-next {
        background: #00ff9f;
        border: none;
        color: #000;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .tooltip-next:hover {
        background: #00e690;
      }
      .onboarding-highlight {
        position: fixed;
        border: 2px solid #00ff9f;
        border-radius: 12px;
        pointer-events: none;
        z-index: 9998;
        opacity: 0;
        transition: all 0.3s ease;
        background: transparent;
      }
      .onboarding-highlight.visible {
        opacity: 1;
      }
      .onboarding-highlight::before {
        content: '';
        position: absolute;
        top: -5px;
        left: -5px;
        right: -5px;
        bottom: -5px;
        border: 2px solid rgba(0, 255, 159, 0.3);
        border-radius: 15px;
        animation: pulseHighlight 2s ease-in-out infinite;
      }
      @keyframes pulseHighlight {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
  }

  public getHTML(): string {
    return `
      <div class="onboarding-highlight" id="onboarding-highlight"></div>
      <div class="onboarding-tooltip" id="onboarding-tooltip">
        <div class="tooltip-header">
          <span class="tooltip-step" id="tooltip-step"></span>
        </div>
        <div class="tooltip-title" id="tooltip-title"></div>
        <div class="tooltip-description" id="tooltip-description"></div>
        <div class="tooltip-footer">
          <div class="tooltip-dots" id="tooltip-dots"></div>
          <div class="tooltip-actions">
            <button class="tooltip-skip" id="tooltip-skip">Skip</button>
            <button class="tooltip-next" id="tooltip-next">Next</button>
          </div>
        </div>
      </div>
    `;
  }

  public setup(): void {
    const skipBtn = this.shadowRoot.getElementById('tooltip-skip');
    const nextBtn = this.shadowRoot.getElementById('tooltip-next');

    skipBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.complete();
    });

    nextBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.nextStep();
    });

    this.renderDots();
  }

  private renderDots(): void {
    const dotsContainer = this.shadowRoot.getElementById('tooltip-dots');
    if (!dotsContainer) return;

    dotsContainer.innerHTML = this.steps
      .map((_, i) => `<div class="tooltip-dot" data-index="${i}"></div>`)
      .join('');
  }

  private getElementRect(elementId: string): DOMRect | null {
    const element = this.shadowRoot.getElementById(elementId);
    if (!element) return null;
    return element.getBoundingClientRect();
  }

  private updateStep(): void {
    if (!this.isActive) return;

    const step = this.steps[this.currentStep];
    const rect = this.getElementRect(step.targetId);

    if (!rect || rect.width === 0) {
      setTimeout(() => this.updateStep(), 100);
      return;
    }

    const padding = step.targetId === 'paragraph-container' ? 16 : 8;

    // Update highlight position
    const highlight = this.shadowRoot.getElementById('onboarding-highlight');
    if (highlight) {
      highlight.style.top = `${rect.top - padding}px`;
      highlight.style.left = `${rect.left - padding}px`;
      highlight.style.width = `${rect.width + padding * 2}px`;
      highlight.style.height = `${rect.height + padding * 2}px`;
    }

    // Update tooltip
    this.updateTooltip(step, rect, padding);

    // Update dots
    const dots = this.shadowRoot.querySelectorAll('.tooltip-dot');
    dots.forEach((dot, i) => {
      dot.classList.remove('active', 'completed');
      if (i === this.currentStep) {
        dot.classList.add('active');
      } else if (i < this.currentStep) {
        dot.classList.add('completed');
      }
    });

    // Update button text
    const nextBtn = this.shadowRoot.getElementById('tooltip-next');
    if (nextBtn) {
      nextBtn.textContent = this.currentStep === this.steps.length - 1 ? 'Got it!' : 'Next';
    }
  }

  private updateTooltip(step: OnboardingStep, rect: DOMRect, padding: number): void {
    const tooltip = this.shadowRoot.getElementById('onboarding-tooltip');
    const stepEl = this.shadowRoot.getElementById('tooltip-step');
    const titleEl = this.shadowRoot.getElementById('tooltip-title');
    const descEl = this.shadowRoot.getElementById('tooltip-description');

    if (!tooltip) return;

    // Update content
    if (stepEl) stepEl.textContent = `${this.currentStep + 1} of ${this.steps.length}`;
    if (titleEl) titleEl.textContent = step.title;
    if (descEl) descEl.textContent = step.description;

    // Calculate position
    const tooltipWidth = 280;
    const tooltipHeight = 160;
    const gap = 16;

    const targetTop = rect.top - padding;
    const targetLeft = rect.left - padding;
    const targetWidth = rect.width + padding * 2;
    const targetHeight = rect.height + padding * 2;
    const targetCenterX = targetLeft + targetWidth / 2;
    const targetCenterY = targetTop + targetHeight / 2;

    let tooltipTop: number;
    let tooltipLeft: number;

    // Position tooltip so it doesn't overlap with the target
    // 'bottom' = tooltip appears ABOVE the target (tooltip is at bottom of available space)
    // 'top' = tooltip appears BELOW the target
    // 'left' = tooltip appears to the LEFT of target
    // 'right' = tooltip appears to the RIGHT of target
    switch (step.position) {
      case 'top':
        // Tooltip below the target
        tooltipTop = targetTop + targetHeight + gap;
        tooltipLeft = targetCenterX - tooltipWidth / 2;
        break;
      case 'bottom':
        // Tooltip above the target
        tooltipTop = targetTop - tooltipHeight - gap;
        tooltipLeft = targetCenterX - tooltipWidth / 2;
        break;
      case 'left':
        // Tooltip to the left of target
        tooltipTop = targetCenterY - tooltipHeight / 2;
        tooltipLeft = targetLeft - tooltipWidth - gap;
        break;
      case 'right':
        // Tooltip to the right of target
        tooltipTop = targetCenterY - tooltipHeight / 2;
        tooltipLeft = targetLeft + targetWidth + gap;
        break;
    }

    // Keep within viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    tooltipLeft = Math.max(16, Math.min(tooltipLeft, vw - tooltipWidth - 16));
    tooltipTop = Math.max(16, Math.min(tooltipTop, vh - tooltipHeight - 16));

    tooltip.style.top = `${tooltipTop}px`;
    tooltip.style.left = `${tooltipLeft}px`;
  }

  private nextStep(): void {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.updateStep();
    } else {
      this.complete();
    }
  }

  private complete(): void {
    this.hide();
    if (this.onCompleteCallback) {
      this.onCompleteCallback();
    }
  }

  public show(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.currentStep = 0;

    const highlight = this.shadowRoot.getElementById('onboarding-highlight');
    const tooltip = this.shadowRoot.getElementById('onboarding-tooltip');

    setTimeout(() => {
      this.updateStep();
      highlight?.classList.add('visible');
      tooltip?.classList.add('visible');
    }, 400);
  }

  public hide(): void {
    this.isActive = false;
    const highlight = this.shadowRoot.getElementById('onboarding-highlight');
    const tooltip = this.shadowRoot.getElementById('onboarding-tooltip');
    highlight?.classList.remove('visible');
    tooltip?.classList.remove('visible');
  }

  public onComplete(callback: () => void): void {
    this.onCompleteCallback = callback;
  }
}
