import { transformPoint } from "../matrix";
import { IInteractionPoint, zSort } from "../util";
import { Container, IContainer, IContainerProps } from "./Container";
import { ISprite } from "./Sprite";

interface IInteractionPointIndex {
  [id: number]: IInteractionPoint;
}

export interface IInteractionManager extends IContainer {
  canvas: HTMLCanvasElement;
  mousePoint: IInteractionPoint;
  touchPointIndex: IInteractionPointIndex;

  hookEvents(): void;
  dispose(): void;
  createInteractionPoint(id: string, type: "Touch" | "Mouse"): IInteractionPoint;
  addTouchPoint(touch: Touch): IInteractionPoint;
  removeTouchPoint(touch: Touch): void;
  pointDown(point: IInteractionPoint, position: Touch | MouseEvent): void;
  pointUp(point: IInteractionPoint, position: Touch | MouseEvent): void;
  pointMove(point: IInteractionPoint, position: Touch | MouseEvent): void;
  pointCancel(point: IInteractionPoint, position: Touch | MouseEvent): void;

  // high level events
  mouseDown(event: MouseEvent): void;
  mouseUp(event: MouseEvent): void;
  mouseMove(event: MouseEvent): void;
  touchStart(event: TouchEvent): void;
  touchEnd(event: TouchEvent): void;
  touchMove(event: TouchEvent): void;
  touchCancel(event: TouchEvent): void;
}

interface IInteractionPointEvent {
  target: HTMLElement;
  event: string;
  listener: (e: MouseEvent | TouchEvent) => void;
}

export interface IInteractionManagerProps extends IContainerProps {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export class InteractionManager extends Container implements IInteractionManager {
  public canvas: HTMLCanvasElement = null;
  public ctx: CanvasRenderingContext2D = null;
  public touchPointIndex: IInteractionPointIndex = {};
  public mousePoint: IInteractionPoint = {
    active: null,
    captured: false,
    clicked: false,
    down: false,
    firstDown: false,
    hover: null,
    id: "mouse",
    tx: 0,
    ty: 0,
    type: "Mouse",
    x: 0,
    y: 0,
  };
  private events: IInteractionPointEvent[] = [
    { target: null, event: "mousedown", listener: e => this.mouseDown(e as MouseEvent) },
    { target: document.body, event: "mouseup", listener: e => this.mouseUp(e as MouseEvent) },
    { target: null, event: "mousemove", listener: e => this.mouseMove(e as MouseEvent) },
    { target: null, event: "touchstart", listener: e => this.touchStart(e as TouchEvent) },
    { target: document.body, event: "touchend", listener: e => this.touchEnd(e as TouchEvent) },
    { target: null, event: "touchmove", listener: e => this.touchMove(e as TouchEvent) },
    { target: document.body, event: "touchcancel", listener: e => this.touchCancel(e as TouchEvent) },
  ];

  constructor(props: IInteractionManagerProps) {
    super(props);
    this.canvas = props.canvas;
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      document.body.appendChild(this.canvas);
    }
    this.canvas.width = props.width;
    this.canvas.height = props.height;
    this.ctx = this.canvas.getContext("2d");
    this.hookEvents();
    this.addPoint(this.mousePoint);
  }

  public hookEvents(): void {
    this.events.forEach(
      event => (event.target || this.canvas)
        .addEventListener(event.event, event.listener),
    );
  }

  public dispose(): void {
    this.events.forEach(
      event => (event.target || this.canvas)
        .removeEventListener(event.event, event.listener),
    );
  }

  public mouseDown(event: MouseEvent): void {
    return this.pointDown(this.mousePoint, event);
  }

  public mouseUp(event: MouseEvent): void {
    return this.pointUp(this.mousePoint, event);
  }

  public mouseMove(event: MouseEvent): void {
    return this.pointMove(this.mousePoint, event);
  }

  public touchStart(event: TouchEvent): void {
    let touch: Touch;
    let point: IInteractionPoint;
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < event.changedTouches.length; i++) {
      touch = event.changedTouches[i];
      point = this.addTouchPoint(touch);
      this.pointDown(point, touch);
    }
  }

  public touchEnd(event: TouchEvent): void {
    let touch: Touch = null;
    let point: IInteractionPoint;

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < event.changedTouches.length; i++) {
      touch = event.changedTouches[i];
      point = this.touchPointIndex[touch.identifier];
      this.pointUp(point, touch);
      this.removeTouchPoint(touch);
    }
  }

  public touchCancel(event: TouchEvent): void {
    let touch: Touch = null;
    let point: IInteractionPoint;

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < event.changedTouches.length; i++) {
      touch = event.changedTouches[i];
      point = this.touchPointIndex[touch.identifier];
      this.pointCancel(point, touch);
      this.removeTouchPoint(touch);
    }
  }

  public touchMove(event: TouchEvent): void {
    let touch: Touch = null;
    let point: IInteractionPoint;

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < event.changedTouches.length; i++) {
      touch = event.changedTouches[i];
      point = this.touchPointIndex[touch.identifier];
      this.pointMove(point, touch);
    }
  }
  public pointDown(point: IInteractionPoint, position: Touch | MouseEvent): void {
    const alreadyDown = point.down;
    if (!alreadyDown) {
       point.down = true;
       point.firstDown = true;
    }
    this.pointMove(point, position);
    if (alreadyDown) {
      return;
    }
    if (point.hover) {
      point.active = point.hover;
      point.active.down = true;
      point.active.active = true;
      // point.active.emit("down", point); // TODO
    }
    // this.emit("point-down", point); // TODO
    point.firstDown = false; // after this point, the point will not be considered "just recently pressed"
  }

  public pointUp(point: IInteractionPoint, position: Touch | MouseEvent): void {
    this.pointMove(point, position);
    if (!point.down) {
      return;
    }
    point.down = false;
    if (point.active) {
      point.active.down = false;
      point.active.active = false;
      // point.active.emit("up", point); // TODO
      if (point.hover === point.active) {
        // point.active.emit("click", point); // TODO
      }
      point.active = null;
    }
    // super.emit("point-up", point); // TODO
    // super.emit("click", point); // TODO
  }

  public pointMove(point: IInteractionPoint, position: Touch | MouseEvent): void {
    const now = Date.now();
    const rect = this.canvas.getBoundingClientRect();
    point.x = position.clientX - rect.left;
    point.y = position.clientY - rect.top;

    if (point.hover) {
      point.hover.hover = false;
      point.hover = null;
    }
    // sprites sorted by ascending z level
    // REASON: Higher z levels are drawn last, so forward-iterating through the
    // array and drawing the sprites will yield the correct result.
    this.sprites.sort(zSort);

    // find the highest z level sprite the point collides with
    // loop is reversed due to z levels being sorted ascendingly
    let sprite: ISprite;
    let hoveringSprite: ISprite;
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      sprite = this.sprites[i];
      hoveringSprite = sprite.isHovering(point, now);

      if (hoveringSprite) {
        hoveringSprite.hover = true;
        point.hover = hoveringSprite; // this can later be used by pointDown and pointUp
        hoveringSprite.pointCollision(point);
        // hoveringSprite.emit("point-move", point); // TODO
        break; // we've found the highest z level sprite the point collides with
      }
    }

    // super.emit("point-move", point); // TODO
  }

  public pointCancel(point: IInteractionPoint, position: Touch | MouseEvent): void {
    if (point.active) {
      point.active.active = false;
      point.active = null;
    }
    if (point.hover) {
      point.hover.hover = false;
      point.hover = null;
    }
  }

  public createInteractionPoint(id: string, type: "Touch" | "Mouse"): IInteractionPoint {
    const point: IInteractionPoint = {
      active: null,
      captured: false,
      clicked: false,
      down: false,
      firstDown: false,
      hover: null,
      id,
      tx: 0,
      ty: 0,
      type,
      x: 0,
      y: 0,
    };

    return point;
  }

  public addTouchPoint(touch: Touch): IInteractionPoint {
    const point = this.createInteractionPoint(touch.identifier.toString(), "Touch");
    this.addPoint(point);
    this.touchPointIndex[touch.identifier] = point;
    return point;
  }

  public removeTouchPoint(touch: Touch): void {
    const point: IInteractionPoint = this.touchPointIndex[touch.identifier];
    delete this.touchPointIndex[touch.identifier];
    this.removePoint(point);
  }

  public hoverCheck(now: number): void {
    let point: IInteractionPoint;
    let sprite: ISprite;

    for (point of this.points) {
      if (point.hover) {
        point.hover.hover = false;
        point.hover = null;
      }

      for (sprite of this.sprites) {
        if (sprite.isHovering(point, now)) {
          sprite.pointCollision(point);
          point.hover = sprite;
          sprite.hover = true;
          break;
        }
      }
    }
  }
}
