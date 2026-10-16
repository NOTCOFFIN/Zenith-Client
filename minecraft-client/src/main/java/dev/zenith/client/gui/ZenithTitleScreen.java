package dev.zenith.client.gui;

import dev.zenith.client.ZenithClient;
import dev.zenith.client.gui.widget.ZenithButton;
import dev.zenith.client.hud.Theme;
import net.minecraft.SharedConstants;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Mth;

/** Zenith replacement for the vanilla title screen. */
public final class ZenithTitleScreen extends Screen {
    private static final String COPYRIGHT = "Copyright Mojang AB. Do not distribute!";
    private final long openedAt = System.currentTimeMillis();

    public ZenithTitleScreen() { super(Component.literal("Zenith Client")); }

    @Override protected void init() {
        int bw = 200, bh = 22, gap = 6;
        int x = width / 2 - bw / 2;
        int y = height / 2 - 10;
        addRenderableWidget(new ZenithButton(x, y, bw, bh, Component.literal("Singleplayer"), true, () -> minecraft.setScreen(new SelectWorldScreen(this))));
        addRenderableWidget(new ZenithButton(x, y + (bh + gap), bw, bh, Component.literal("Multiplayer"), false, () -> minecraft.setScreen(new JoinMultiplayerScreen(this))));
        addRenderableWidget(new ZenithButton(x, y + (bh + gap) * 2, bw, bh, Component.literal("Zenith Settings"), false, () -> minecraft.setScreen(new ZenithScreen(this))));
        int half = (bw - gap) / 2;
        addRenderableWidget(new ZenithButton(x, y + (bh + gap) * 3, half, bh, Component.literal("Options"), false, () -> minecraft.setScreen(new OptionsScreen(this, minecraft.options))));
        addRenderableWidget(new ZenithButton(x + half + gap, y + (bh + gap) * 3, bw - half - gap, bh, Component.literal("Quit"), false, () -> minecraft.stop()));
    }

    @Override public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        float t = (System.currentTimeMillis() - openedAt) / 1000f;
        g.fillGradient(0, 0, width, height, 0xFF0B0D14, 0xFF111827);
        // slow drifting glow orbs
        orb(g, (int) (width * 0.25 + Math.sin(t * 0.3) * 40), (int) (height * 0.3 + Math.cos(t * 0.2) * 30), 140, 0x183B82F6);
        orb(g, (int) (width * 0.75 + Math.cos(t * 0.25) * 40), (int) (height * 0.7 + Math.sin(t * 0.3) * 30), 160, 0x188B5CF6);
    }

    private static void orb(GuiGraphics g, int cx, int cy, int r, int color) {
        for (int i = r; i > 0; i -= 12) g.fill(cx - i, cy - i, cx + i, cy + i, color);
    }

    @Override public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        super.render(g, mouseX, mouseY, partialTick);
        float fade = Mth.clamp((System.currentTimeMillis() - openedAt) / 600f, 0, 1);
        int logoY = height / 2 - 78;
        g.pose().pushPose();
        g.pose().translate(width / 2f, logoY, 0);
        g.pose().scale(4f, 4f, 1f);
        String title = "ZENITH";
        int tw = font.width(title);
        int a = (int) (fade * 255) << 24;
        g.drawString(font, title, -tw / 2, 0, a | 0xFFFFFF, true);
        g.pose().popPose();
        int lineW = (int) (120 * fade);
        g.fillGradient(width / 2 - lineW, logoY + 38, width / 2 + lineW, logoY + 39, Theme.BLUE, Theme.VIOLET);
        g.drawCenteredString(font, "Reach Your Peak.", width / 2, logoY + 46, Theme.TEXT_DIM);
        String version = "Zenith Client " + ZenithClient.version() + " | Minecraft " + SharedConstants.getCurrentVersion().getName();
        boolean stack = font.width(version) + font.width(COPYRIGHT) + 16 > width;
        g.drawString(font, version, 4, height - (stack ? 22 : 12), Theme.TEXT_DIM, false);
        g.drawString(font, COPYRIGHT, width - font.width(COPYRIGHT) - 4, height - 12, Theme.TEXT_DIM, false);
        String user = "Signed in as " + minecraft.getUser().getName();
        g.drawString(font, user, width - font.width(user) - 4, 4, Theme.TEXT_DIM, false);
    }

    @Override public boolean shouldCloseOnEsc() { return false; }
}
