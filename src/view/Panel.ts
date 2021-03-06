import { transformPoint } from "../matrix";
import { IInteractionPoint, SpriteType } from "../util";
import { ISprite, ISpriteProps, Sprite } from "./Sprite";

const sortZ = (a: ISprite, b: ISprite): number => a.z - b.z;

export interface IPanel extends ISprite {
  addSprite(sprite: ISprite): this;
  removeSprite(sprite: ISprite): this;
  focus(sprite: ISprite): void;
}

export interface IPanelProps extends ISpriteProps {}

export class Panel extends Sprite implements IPanel {
  public readonly type: SpriteType = SpriteType.Panel;
  private sprites: ISprite[] = [];

  constructor(props: IPanelProps) {
    super(props);
  }

  public addSprite(sprite: ISprite): this {
    sprite.parent = this;
    this.sprites.push(sprite);
    return this;
  }

  public interpolate(now: number) {
    if (now <= this.lastInterpolated) {
      return;
    }
    super.interpolate(now);
    for (const sprite of this.sprites) {
      sprite.interpolate(now);
    }
  }

  public removeSprite(sprite: ISprite): this {
    if (this.sprites.includes(sprite)) {
      this.sprites.splice(this.sprites.indexOf(sprite), 1);
      sprite.parent = null;
    }

    return this;
  }

  public broadPhase(point: IInteractionPoint): boolean {
    this.sprites.sort(sortZ);

    for (const sprite of this.sprites) {
      sprite.down = false;
      sprite.hover = false;
    }
    return super.broadPhase(point);
  }

  public narrowPhase(point: IInteractionPoint): ISprite {
    let sprite: ISprite = null;
    let collision: ISprite = null;

    for (let i = this.sprites.length - 1; i >= 0; i--) {
      sprite = this.sprites[i];

      // the sprites inverse has already been calculated relative to the parent
      transformPoint(point, sprite.inverse);

      if (!sprite.broadPhase(point)) {
        continue;
      }

      collision = sprite.narrowPhase(point);
      if (collision) {
        return collision;
      }
    }
    return this;
  }

  public update(): void {
    this.hover = false;
    for (const sprite of this.sprites) {
      sprite.update();

      if (sprite.hover) {
        this.hover = sprite.hover;
        this.cursor = sprite.cursor;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    super.render(ctx);

    ctx.beginPath();
    ctx.rect(0, 0, this.width, this.height);
    ctx.clip();

    for (const sprite of this.sprites) {
      ctx.save();
      ctx.transform(
        sprite.interpolatedPosition[0],
        sprite.interpolatedPosition[1],
        sprite.interpolatedPosition[2],
        sprite.interpolatedPosition[3],
        sprite.interpolatedPosition[4],
        sprite.interpolatedPosition[5],
      );
      ctx.globalAlpha *= sprite.interpolatedAlpha;
      sprite.render(ctx);
      ctx.restore();
    }
  }

  public focus(target: ISprite) {
    for (const sprite of this.sprites) {
      sprite.focused = sprite === target;
      if (sprite.type === SpriteType.Panel) {
        const panel = sprite as IPanel;
        panel.focus(target);
      }
    }
  }

  public isFocused(): ISprite {
    for (const sprite of this.sprites) {
      if (sprite.isFocused()) {
        return sprite;
      }
    }
    return super.isFocused();
  }

  public skipAnimation(now: number): boolean {
    let result: boolean = super.skipAnimation(now);
    for (const sprite of this.sprites) {
      result = sprite.skipAnimation(now) || result;
    }
    return result;
  }
}
