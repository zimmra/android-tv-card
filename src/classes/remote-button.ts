import { CSSResult, TemplateResult, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { BaseRemoteElement } from './base-remote-element';

@customElement('remote-button')
export class RemoteButton extends BaseRemoteElement {
	@property({ attribute: false }) actionKey!: string;
	@property({ attribute: false }) icons!: Record<string, string>;
	@property({ attribute: false }) label?: string; // New property for the text label

	clickTimer?: ReturnType<typeof setTimeout>;
	clickCount: number = 0;

	holdTimer?: ReturnType<typeof setTimeout>;
	holdInterval?: ReturnType<typeof setInterval>;
	hold: boolean = false;

	onClick(e: TouchEvent | MouseEvent) {
		e.stopImmediatePropagation();
		this.clickCount++;

		if (
			'double_tap_action' in this.actions &&
			this.renderTemplate(
				this.actions.double_tap_action?.action ?? 'none',
			) != 'none'
		) {
			// Double tap action is defined
			if (this.clickCount > 1) {
				// Double tap action is triggered
				this.fireHapticEvent('success');
				this.sendAction('double_tap_action');
				this.endAction();
			} else {
				// Single tap action is triggered if double tap is not within 200ms
				const doubleTapWindow: number =
					'double_tap_window' in
					(this.actions.double_tap_action ?? {})
						? (this.renderTemplate(
								this.actions.double_tap_action
									?.double_tap_window as unknown as string,
						  ) as number)
						: 200;
				if (!this.clickTimer) {
					this.clickTimer = setTimeout(() => {
						this.fireHapticEvent('light');
						this.sendAction('tap_action');
						this.endAction();
					}, doubleTapWindow);
				}
			}
		} else {
			// No double tap action defined, tap action is triggered
			this.fireHapticEvent('light');
			this.sendAction('tap_action');
			this.endAction();
		}
	}

	onStart(e: TouchEvent | MouseEvent) {
		this.swiping = false;
		if ('targetTouches' in e) {
			this.initialX = e.targetTouches[0].clientX;
			this.initialY = e.targetTouches[0].clientY;
		} else {
			this.initialX = e.clientX;
			this.initialY = e.clientY;
		}

		if (
			'momentary_start_action' in this.actions &&
			this.renderTemplate(
				this.actions.momentary_start_action?.action ?? 'none',
			) != 'none'
		) {
			this.fireHapticEvent('light');
			this.buttonPressStart = performance.now();
			this.sendAction('momentary_start_action');
		} else if (
			'momentary_end_action' in this.actions &&
			this.renderTemplate(
				this.actions.momentary_end_action?.action ?? 'none',
			) != 'none'
		) {
			this.fireHapticEvent('light');
			this.buttonPressStart = performance.now();
		} else if (!this.holdTimer) {
			const holdTime =
				'hold_time' in (this.actions.hold_action ?? {})
					? (this.renderTemplate(
							this.actions.hold_action
								?.hold_time as unknown as string,
					  ) as number)
					: 500;

			this.holdTimer = setTimeout(() => {
				if (!this.swiping) {
					this.hold = true;

					if (
						this.renderTemplate(
							this.actions.hold_action?.action as string,
						) == 'repeat'
					) {
						const repeat_delay =
							'repeat_delay' in (this.actions.hold_action ?? {})
								? (this.renderTemplate(
										this.actions.hold_action
											?.repeat_delay as unknown as string,
								  ) as number)
								: 100;
						if (!this.holdInterval) {
							this.holdInterval = setInterval(() => {
								this.fireHapticEvent('selection');
								this.sendAction('tap_action');
							}, repeat_delay);
						}
					} else {
						this.fireHapticEvent('medium');
						this.sendAction('hold_action');
					}
				}
			}, holdTime);
		}
	}

	onEnd(e: TouchEvent | MouseEvent) {
		if (!this.swiping) {
			if (
				'momentary_end_action' in this.actions &&
				this.renderTemplate(
					this.actions.momentary_end_action?.action ?? 'none',
				) != 'none'
			) {
				this.fireHapticEvent('selection');
				this.buttonPressEnd = performance.now();
				this.sendAction('momentary_end_action');
				this.endAction();
			} else if (
				'momentary_start_action' in this.actions &&
				this.renderTemplate(
					this.actions.momentary_start_action?.action ?? 'none',
				) != 'none'
			) {
				this.endAction();
			} else if (this.hold) {
				// Hold action is triggered
				e.stopImmediatePropagation();
				e.preventDefault();
				this.endAction();
			} else {
				// Hold action is not triggered, fire tap action
				this.onClick(e);
			}
		}
	}

	onMove(e: TouchEvent | MouseEvent) {
		let currentX: number;
		let currentY: number;
		if ('targetTouches' in e) {
			currentX = e.targetTouches[0].clientX;
			currentY = e.targetTouches[0].clientY;
		} else {
			currentX = e.clientX;
			currentY = e.clientY;
		}

		const diffX = (this.initialX ?? currentX) - currentX;
		const diffY = (this.initialY ?? currentY) - currentY;

		// Only consider significant enough movement
		const sensitivity = 8;
		if (Math.abs(Math.abs(diffX) - Math.abs(diffY)) > sensitivity) {
			this.endAction();
			this.swiping = true;
		}
	}

	onMouseLeave(_e: MouseEvent) {
		this.endAction();
		this.swiping = true;
	}

	endAction() {
		clearTimeout(this.clickTimer as ReturnType<typeof setTimeout>);
		this.clickTimer = undefined;
		this.clickCount = 0;

		clearTimeout(this.holdTimer as ReturnType<typeof setTimeout>);
		clearInterval(this.holdInterval as ReturnType<typeof setInterval>);
		this.holdTimer = undefined;
		this.holdInterval = undefined;
		this.hold = false;

		super.endAction();
	}

	render(inputTemplate?: TemplateResult<1>) {
		this.setValue();
		
		const icon = this.renderTemplate(this.actions.icon ?? '') as string;
		let haIcon = html``;
		let svgPath;
		if (icon.includes(':')) {
			haIcon = html`<ha-icon .icon="${icon}"></ha-icon>`;
		} else {
			svgPath = this.icons[icon] ?? icon;
		}

		const action = this.renderTemplate(this.actionKey);
		return html`
			<ha-icon-button
				title="${action}"
				style=${styleMap(this.buildStyle(this.actions.style ?? {}))}
				@mousedown=${this.onMouseDown}
				@mouseup=${this.onMouseUp}
				@mousemove=${this.onMouseMove}
				@mouseleave=${this.onMouseLeave}
				@touchstart=${this.onTouchStart}
				@touchend=${this.onTouchEnd}
				@touchmove=${this.onTouchMove}
				@contextmenu=${this.onContextMenu}
				.action=${action}
				.path=${svgPath}
			>
				${haIcon}${inputTemplate}
				${this.label ? html`<div class="button-label">${this.label}</div>` : ''}
			</ha-icon-button>
		`;
	}

	static get styles(): CSSResult | CSSResult[] {
		return [
			super.styles as CSSResult,
			css`
				ha-icon-button,
				ha-icon,
				svg {
					display: flex;
					height: var(--size);
					width: var(--size);
				}
				ha-icon-button {
					cursor: pointer;
					position: relative;
					display: inline-flex;
					flex-direction: column;
					justify-content: center;
					text-align: center;
					align-items: center;
					z-index: 1;
					--size: 48px;
					--mdc-icon-size: var(--size);
					--mdc-icon-button-size: var(--size);
					-webkit-tap-highlight-color: transparent;
				}
				.button-label {
					font-size: 12px;
					margin-top: 4px;
				}
			`,
		];
	}
}
