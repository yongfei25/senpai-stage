import { IKeyDownEvent } from "../events";
import { IPadding, SpriteType, TextBaseline } from "../util";
import { ISprite, ISpriteProps, Sprite } from "./Sprite";

const unicodeCharacterTest = /^.$/u;
export enum SelectionState {
  Selection,
  Caret,
}

export interface ITextInput extends ISprite {
  text: string[];
  font: string;
  fontSize: number;
  fontColor: string;
  selectionState: SelectionState;
  caretIndex: number;
  selectionStart: number;
  selectionEnd: number;
  caretX: number;
  padding: IPadding;
  frameCount: number;
  setText(text: string): this;
  select(begin: number, end: number): this;
}

export interface ITextInputProps extends ISpriteProps {
  text?: string;
  font?: string;
  fontSize?: number;
  fontColor?: string;
  width: number;
  height: number;
}

const tempctx = document.createElement("canvas").getContext("2d");

export class TextInput extends Sprite implements ITextInput {
  public readonly type: SpriteType = SpriteType.TextInput;
  public text: string[] = [];
  public font: string = "monospace";
  public fontSize: number = 12;
  public fontColor: string = "black";
  public caretIndex: number = 0;
  public caretX: number = 0;
  public textScroll: number = 0;
  public selectionState: SelectionState = SelectionState.Caret;
  public padding: IPadding = {
    bottom: 2,
    left: 2,
    right: 2,
    top: 2,
  };
  public selectionEnd: number = -1;
  public selectionStart: number = -1;
  public frameCount: number = 0;
  private showCaret: boolean = true;
  private focusedMidPattern: CanvasPattern = null;
  private unfocusedMidPattern: CanvasPattern = null;

  constructor(props: ITextInputProps) {
    super(props);
    this.text = props.text ? props.text.split("") : this.text;
    this.font = props.font || this.font;
    this.fontSize = props.fontSize || this.fontSize;
    this.fontColor = props.fontColor || this.fontColor;
    this.width = props.width || this.width;
    this.height = props.height || this.height;
  }

  public update(): void {
    // noOp
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const left = this.focused ? this.textures.Focused_Left : this.textures.Unfocused_Left;
    const right = this.focused ? this.textures.Focused_Right : this.textures.Unfocused_Right;
    const pattern = this.focused ? this.textures.Focused_Mid : this.textures.Unfocused_Mid;
    ctx.drawImage(this.textures.Left_Cap_Active, 0, 0);
    ctx.drawImage(left, 0, 0);
    ctx.drawImage(right, this.width - right.width, 0);
    ctx.fillStyle = this.focused ? this.focusedMidPattern : this.unfocusedMidPattern;
    ctx.fillRect(
      left.width,
      0,
      this.width - left.width - right.width,
      pattern.height,
    );

    // clip
    ctx.beginPath();
    ctx.rect(
      this.padding.left,
      this.padding.top,
      this.width - this.padding.right - this.padding.left,
      this.width - this.padding.bottom,
    );
    ctx.clip();

    const text = this.text.join("");
    // draw text
    ctx.font = `${this.fontSize}px ${this.font}`;
    ctx.fillStyle = this.fontColor;
    ctx.textBaseline = TextBaseline.top;
    ctx.fillText(text, this.textScroll + this.padding.left, 0);

    if (this.showCaret) {
      const caretX = this.textScroll + this.padding.left + this.caretIndex;
      ctx.beginPath();
      ctx.moveTo(caretX, this.padding.top);
      ctx.lineTo(caretX, this.height - this.padding.bottom);
      ctx.stroke();
    }
  }

  public setText(text: string): this {
    this.text = text.split("");
    return this;
  }

  public keyDown(e: IKeyDownEvent): void {
    if (this.selectionState === SelectionState.Selection) {
      this.keyDownSelection(e);
    } else if (this.selectionState === SelectionState.Caret) {
      this.keyDownCaret(e);
    }

    return super.keyDown(e);
  }
  public select(begin: number, end: number): this {
    if (!Number.isFinite(begin)) {
      throw new Error(`Cannot select text on sprite ${this.id}: begin is not finite`);
    }
    if (!Number.isFinite(end)) {
      throw new Error(`Cannot select text on sprite ${this.id}: end is not finite`);
    }
    begin = Math.floor(begin);
    if (this.text.length < begin || begin < 0) {
      throw new Error(`Cannot select text on sprite ${this.id}: begin is not in range`);
    }
    end = Math.floor(end);
    if (this.text.length < begin || begin < 0) {
      throw new Error(`Cannot select text on sprite ${this.id}: end is not in range`);
    }
    if (begin > end) {
      throw new Error(`Cannot select text on sprite ${this.id}: begin is greater than end`);
    }

    this.selectionState = SelectionState.Selection;
    this.selectionStart = begin;
    this.selectionEnd = end;
    this.caretIndex = Math.min(Math.max(begin, this.caretIndex), end);
    return this;
  }
  private keyDownCaret(e: IKeyDownEvent): void {
    if (unicodeCharacterTest.test(e.key)) {
      this.text.splice(this.caretIndex, 0, e.key);
      this.caretIndex += 1;
      return;
    }

    switch (e.key) {
      case "Backspace":
        this.text.splice(this.caretIndex, 1);
        this.caretIndex -= 1;
        break;
    }
  }

  private keyDownSelection(e: IKeyDownEvent): void {
    if (unicodeCharacterTest.test(e.key)) {
      this.text.splice(this.selectionStart, this.selectionEnd - this.selectionStart, e.key);
      this.caretIndex = this.selectionStart + 1;
      this.selectionState = SelectionState.Caret;
      this.selectionStart = -1;
      this.selectionEnd = -1;
      return;
    }

    switch (e.key) {
      case "Backspace":
        this.text.splice(this.caretIndex, this.selectionEnd - this.selectionStart);
        this.caretIndex = this.selectionStart;
        this.selectionState = SelectionState.Caret;
        break;
    }
  }
}
