package dev.zenith.client.gui.widget;

import dev.zenith.client.hud.Theme;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractButton;
import net.minecraft.client.gui.narration.NarrationElementOutput;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Mth;

/** Flat glass-style button with an animated blue/violet hover accent. */
public class ZenithButton extends AbstractButton {
    private final Runnable action;
    private final boolean primary;
    private float hover;

    public ZenithButton(int x, int y, int w, int h, Component label, boolean primary, Runnable action) {
        super(x, y, w, h, label);
        this.action = action;
        this.primary = primary;
    }

    @Override public void onPress() { action.run(); }

    @Override protected void renderWidget(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        float target = isHoveredOrFocused() && active ? 1f : 0f;
        hover += (target - hover) * Math.min(1f, partialTick * 0.5f + 0.15f);
        int x = getX(), y = getY(), w = getWidth(), h = getHeight();
        int base = primary ? 0xE02A4FD6 : Theme.PANEL;
        g.fill(x, y, x + w, y + h, active ? base : 0x80141824);
        int alpha = (int) (hover * 0x60);
        if (alpha > 0) g.fillGradient(x, y, x + w, y + h, (alpha << 24) | 0x3B82F6, (alpha << 24) | 0x8B5CF6);
        int accent = (int) Mth.lerp(hover, 0, w);
        g.fill(x, y + h - 1, x + accent, y + h, Theme.BLUE);
        g.renderOutline(x, y, w, h, Theme.BORDER);
        int color = active ? Theme.TEXT : Theme.TEXT_DIM;
        g.drawCenteredString(Minecraft.getInstance().font, getMessage(), x + w / 2, y + (h - 8) / 2, color);
    }

    @Override protected void updateWidgetNarration(NarrationElementOutput output) { defaultButtonNarrationText(output); }
}
