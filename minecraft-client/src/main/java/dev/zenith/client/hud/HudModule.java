package dev.zenith.client.hud;

import dev.zenith.client.module.Category;
import dev.zenith.client.module.Module;
import dev.zenith.client.module.setting.BooleanSetting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

public abstract class HudModule extends Module {
    private final HudPosition position;
    protected final BooleanSetting background;
    private int lastWidth = 40;
    private int lastHeight = 12;

    protected HudModule(String id, String name, String description, boolean enabled, double x, double y) {
        super(id, name, description, Category.HUD, enabled);
        this.position = new HudPosition(x, y);
        this.background = add(new BooleanSetting("background", "Background", true));
    }

    public HudPosition position() { return position; }
    public int width() { return lastWidth; }
    public int height() { return lastHeight; }

    /** Draws at local origin (0,0) and returns {width, height}. preview is true in the HUD editor. */
    protected abstract int[] draw(GuiGraphics g, Minecraft mc, boolean preview);

    public final void render(GuiGraphics g, Minecraft mc, int screenW, int screenH, boolean preview) {
        float s = (float) position.scale();
        int px = (int) Math.round(position.x() * Math.max(0, screenW - lastWidth * s));
        int py = (int) Math.round(position.y() * Math.max(0, screenH - lastHeight * s));
        g.pose().pushPose();
        g.pose().translate(px, py, 0);
        g.pose().scale(s, s, 1);
        int[] size = draw(g, mc, preview);
        g.pose().popPose();
        if (size != null) {
            lastWidth = Math.max(1, size[0]);
            lastHeight = Math.max(1, size[1]);
        }
    }

    public int screenX(int screenW) {
        return (int) Math.round(position.x() * Math.max(0, screenW - lastWidth * position.scale()));
    }

    public int screenY(int screenH) {
        return (int) Math.round(position.y() * Math.max(0, screenH - lastHeight * position.scale()));
    }

    /** Helper for the common single-line "label: value" element. */
    protected int[] text(GuiGraphics g, Minecraft mc, String text) {
        int w = mc.font.width(text) + 8;
        int h = 13;
        if (background.get()) g.fill(0, 0, w, h, Theme.HUD_BG);
        g.drawString(mc.font, text, 4, 3, Theme.TEXT, true);
        return new int[] {w, h};
    }
}
