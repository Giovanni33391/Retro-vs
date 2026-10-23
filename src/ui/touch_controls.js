// touch_controls.js - Touch and Virtual Gamepad Controller adapting to NES, SNES, Genesis

export class TouchControls {
  constructor(containerElement, onButtonChange, systemType = 'nes') {
    this.container = containerElement;
    this.onButtonChange = onButtonChange;
    this.systemType = systemType; // 'nes', 'snes', 'genesis'
    this.init();
  }

  setSystem(systemType) {
    if (this.systemType !== systemType) {
      this.systemType = systemType;
      this.init();
    }
  }

  init() {
    if (!this.container) return;

    let actionButtonsHtml = '';

    if (this.systemType === 'snes') {
      // SNES Diamond: X (top), Y (left), A (right), B (bottom)
      actionButtonsHtml = `
        <div class="action-diamond">
          <button class="t-btn action-btn btn-x" data-btn="9" id="btnX">X</button>
          <div class="diamond-mid">
            <button class="t-btn action-btn btn-y" data-btn="1" id="btnY">Y</button>
            <button class="t-btn action-btn btn-a" data-btn="8" id="btnA">A</button>
          </div>
          <button class="t-btn action-btn btn-b" data-btn="0" id="btnB">B</button>
        </div>
      `;
    } else if (this.systemType === 'genesis') {
      // Genesis 3-Button Row: A, B, C
      actionButtonsHtml = `
        <div class="genesis-row">
          <button class="t-btn action-btn btn-gen-a" data-btn="0" id="btnGenA">A</button>
          <button class="t-btn action-btn btn-gen-b" data-btn="1" id="btnGenB">B</button>
          <button class="t-btn action-btn btn-gen-c" data-btn="2" id="btnGenC">C</button>
        </div>
      `;
    } else {
      // NES 2-Button: B, A
      actionButtonsHtml = `
        <div class="action-zone">
          <button class="t-btn action-btn btn-b" data-btn="1" id="btnB">B</button>
          <button class="t-btn action-btn btn-a" data-btn="0" id="btnA">A</button>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="touch-overlay" id="touchOverlay">
        <div class="dpad-zone">
          <button class="t-btn dpad-btn" data-btn="6" id="btnLeft">◀</button>
          <div class="dpad-vert">
            <button class="t-btn dpad-btn" data-btn="4" id="btnUp">▲</button>
            <button class="t-btn dpad-btn" data-btn="5" id="btnDown">▼</button>
          </div>
          <button class="t-btn dpad-btn" data-btn="7" id="btnRight">▶</button>
        </div>

        <div class="center-zone">
          <button class="t-btn sys-btn" data-btn="2" id="btnSelect">SELECT</button>
          <button class="t-btn sys-btn" data-btn="3" id="btnStart">START</button>
        </div>

        ${actionButtonsHtml}
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const buttons = this.container.querySelectorAll(".t-btn");

    buttons.forEach((btn) => {
      const btnIndex = parseInt(btn.dataset.btn, 10);

      const press = (e) => {
        e.preventDefault();
        btn.classList.add("pressed");
        if (this.onButtonChange) this.onButtonChange(btnIndex, true);
      };

      const release = (e) => {
        e.preventDefault();
        btn.classList.remove("pressed");
        if (this.onButtonChange) this.onButtonChange(btnIndex, false);
      };

      btn.addEventListener("touchstart", press, { passive: false });
      btn.addEventListener("touchend", release, { passive: false });
      btn.addEventListener("touchcancel", release, { passive: false });

      btn.addEventListener("mousedown", press);
      btn.addEventListener("mouseup", release);
      btn.addEventListener("mouseleave", release);
    });
  }

  show() {
    if (this.container) this.container.style.display = "block";
  }

  hide() {
    if (this.container) this.container.style.display = "none";
  }
}
