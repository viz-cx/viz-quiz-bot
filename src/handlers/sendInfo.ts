import { sendMainKeyboard } from "@/helpers/keyboard";
import { Context } from "telegraf";

export function sendInfo(ctx: Context) {
    sendMainKeyboard(ctx)
}
