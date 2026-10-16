package dev.zenith.client.gui;

import dev.zenith.client.ZenithClient;
import dev.zenith.client.gui.widget.ZenithButton;
import dev.zenith.client.hud.Theme;
import dev.zenith.client.module.Category;
import dev.zenith.client.module.Module;
import dev.zenith.client.module.ModuleManager;
import dev.zenith.client.module.impl.ClientSettingsModule;
import dev.zenith.client.module.setting.BooleanSetting;
import dev.zenith.client.module.setting.ModeSetting;
import dev.zenith.client.module.setting.NumberSetting;
import dev.zenith.client.module.setting.Setting;
import dev.zenith.client.notification.Notifications;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Mth;

/** The Right Shift menu: categories, search, module toggles and per-module settings. */
public final class ZenithScreen extends Screen {
    private static final int SIDEBAR = 112;
    private static final int ROW = 30;
    private static final int SETTING_ROW = 18;

    private final Screen parent;
    private final ModuleManager modules;
    private final Set<String> expanded = new HashSet<>();
    private Category category;
    private String query = "";
    private double scroll;
    private EditBox search;
    private NumberSetting dragging;
    private int dragX, dragW;
    private final long openedAt = System.currentTimeMillis();

    private int px, py, pw, ph;

    private record Row(Module module, Setting<?> setting, int y, int h) {}

    public ZenithScreen(Screen parent) {
        this(parent, null);
    }

    public ZenithScreen(Screen parent, Category initial) {
        super(Component.literal("Zenith Client"));
        this.parent = parent;
        this.modules = ZenithClient.get().modules();
        this.category = initial;
    }

    @Override protected void init() {
        pw = Math.min(width - 20, 480);
        ph = Math.min(height - 20, 300);
        px = (width - pw) / 2;
        py = (height - ph) / 2;
        search = new EditBox(font, px + SIDEBAR + 10, py + 10, pw - SIDEBAR - 20, 16, Component.literal("Search"));
        search.setHint(Component.literal("Search modules and settings..."));
        search.setValue(query);
        search.setResponder(s -> {
            query = s;
            scroll = 0;
        });
        addRenderableWidget(search);
        addRenderableWidget(new ZenithButton(px + 8, py + ph - 52, SIDEBAR - 16, 18, Component.literal("Edit HUD"), true,
                () -> minecraft.setScreen(new HudEditorScreen(this))));
        addRenderableWidget(new ZenithButton(px + 8, py + ph - 28, SIDEBAR - 16, 18, Component.literal("Close"), false, this::onClose));
    }

    @Override public boolean isPauseScreen() { return false; }

    @Override public void onClose() {
        ZenithClient.get().config().save();
        minecraft.setScreen(parent);
    }

    @Override public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        if (minecraft.level == null) {
            g.fillGradient(0, 0, width, height, 0xFF0B0D14, 0xFF111827);
        } else if (modules.get(ClientSettingsModule.class).blur.get()) {
            super.renderBackground(g, mouseX, mouseY, partialTick);
        } else {
            renderTransparentBackground(g);
        }
        renderPanel(g, mouseX, mouseY);
    }

    /** Draws the panel beneath the widgets; Screen.render calls renderBackground before the widgets. */
    private void renderPanel(GuiGraphics g, int mouseX, int mouseY) {
        float open = Mth.clamp((System.currentTimeMillis() - openedAt) / 180f, 0, 1);
        int alpha = (int) (open * 0xF0);
        g.fill(px, py, px + pw, py + ph, (alpha << 24) | (Theme.BG_DARK & 0xFFFFFF));
        g.renderOutline(px, py, pw, ph, Theme.BORDER);
        g.fill(px, py, px + SIDEBAR, py + ph, Theme.PANEL);
        g.fillGradient(px, py, px + pw, py + 1, Theme.BLUE, Theme.VIOLET);

        g.pose().pushPose();
        g.pose().translate(px + 12, py + 12, 0);
        g.pose().scale(1.5f, 1.5f, 1);
        g.drawString(font, "ZENITH", 0, 0, Theme.TEXT, true);
        g.pose().popPose();
        g.drawString(font, "Reach Your Peak.", px + 12, py + 28, Theme.TEXT_DIM, false);

        int cy = py + 46;
        cy = categoryEntry(g, null, "All Modules", cy, mouseX, mouseY);
        for (Category c : Category.values()) cy = categoryEntry(g, c, c.displayName, cy, mouseX, mouseY);

        renderList(g, mouseX, mouseY);
    }

    private int categoryEntry(GuiGraphics g, Category c, String label, int y, int mx, int my) {
        boolean selected = category == c;
        boolean hover = mx >= px + 6 && mx < px + SIDEBAR - 6 && my >= y && my < y + 16;
        if (selected) g.fill(px + 6, y, px + SIDEBAR - 6, y + 16, Theme.BLUE_SOFT);
        else if (hover) g.fill(px + 6, y, px + SIDEBAR - 6, y + 16, 0x20FFFFFF);
        if (selected) g.fill(px + 6, y, px + 8, y + 16, Theme.BLUE);
        int count = c == null ? modules.all().size() : modules.byCategory(c).size();
        g.drawString(font, label, px + 12, y + 4, selected ? Theme.TEXT : Theme.TEXT_DIM, false);
        String n = String.valueOf(count);
        g.drawString(font, n, px + SIDEBAR - 12 - font.width(n), y + 4, Theme.TEXT_DIM, false);
        return y + 18;
    }

    private int listTop() { return py + 34; }
    private int listBottom() { return py + ph - 8; }
    private int listLeft() { return px + SIDEBAR + 10; }
    private int listRight() { return px + pw - 10; }

    private List<Module> visibleModules() {
        String q = query.trim();
        List<Module> out = new ArrayList<>();
        for (Module m : modules.search(category, "")) {
            if (m.matches(q) || m.settings().stream().anyMatch(s -> s.name().toLowerCase().contains(q.toLowerCase()))) out.add(m);
        }
        return out;
    }

    private List<Row> layout() {
        List<Row> rows = new ArrayList<>();
        int y = listTop() - (int) scroll;
        for (Module m : visibleModules()) {
            rows.add(new Row(m, null, y, ROW));
            y += ROW + 2;
            if (expanded.contains(m.id()) || (!query.isBlank() && m.settings().stream().anyMatch(s -> s.name().toLowerCase().contains(query.trim().toLowerCase())))) {
                for (Setting<?> s : m.settings()) {
                    rows.add(new Row(m, s, y, SETTING_ROW));
                    y += SETTING_ROW;
                }
                y += 4;
            }
        }
        return rows;
    }

    private int contentHeight() {
        List<Row> rows = layout();
        if (rows.isEmpty()) return 0;
        Row last = rows.get(rows.size() - 1);
        return last.y + last.h - (listTop() - (int) scroll);
    }

    private void renderList(GuiGraphics g, int mx, int my) {
        int l = listLeft(), r = listRight(), top = listTop(), bottom = listBottom();
        g.enableScissor(l, top, r, bottom);
        List<Row> rows = layout();
        if (rows.isEmpty()) g.drawCenteredString(font, "No modules match \"" + query + "\"", (l + r) / 2, top + 20, Theme.TEXT_DIM);
        for (Row row : rows) {
            if (row.y + row.h < top || row.y > bottom) continue;
            boolean hover = mx >= l && mx < r && my >= row.y && my < row.y + row.h && my >= top && my < bottom;
            if (row.setting == null) renderModuleRow(g, row, l, r, hover);
            else renderSettingRow(g, row, l, r, hover);
        }
        g.disableScissor();
        int content = contentHeight();
        int view = bottom - top;
        if (content > view) {
            int barH = Math.max(16, view * view / content);
            int barY = top + (int) ((view - barH) * (scroll / (content - view)));
            g.fill(r + 3, barY, r + 5, barY + barH, 0x60FFFFFF);
        }
    }

    private void renderModuleRow(GuiGraphics g, Row row, int l, int r, boolean hover) {
        Module m = row.module;
        g.fill(l, row.y, r, row.y + row.h, hover ? Theme.PANEL_LIGHT : Theme.PANEL);
        if (m.enabled()) g.fill(l, row.y, l + 2, row.y + row.h, Theme.BLUE);
        g.drawString(font, m.name(), l + 8, row.y + 5, Theme.TEXT, false);
        g.drawString(font, font.plainSubstrByWidth(m.description(), r - l - 90), l + 8, row.y + 17, Theme.TEXT_DIM, false);
        g.drawString(font, m.category().displayName, r - 44 - font.width(m.category().displayName), row.y + 5, 0xFF5B6478, false);
        if (m.toggleable()) toggle(g, r - 34, row.y + 9, m.enabled());
        if (!m.settings().isEmpty()) g.drawString(font, expanded.contains(m.id()) ? "\u25BE" : "\u25B8", r - 44 - font.width(m.category().displayName) - 12, row.y + 5, Theme.TEXT_DIM, false);
    }

    private void renderSettingRow(GuiGraphics g, Row row, int l, int r, boolean hover) {
        Setting<?> s = row.setting;
        g.fill(l + 10, row.y, r, row.y + row.h, hover ? 0x40FFFFFF & 0x30FFFFFF : 0x18FFFFFF);
        g.drawString(font, s.name(), l + 18, row.y + 5, Theme.TEXT_DIM, false);
        if (s instanceof BooleanSetting b) {
            toggle(g, r - 34, row.y + 3, b.get());
        } else if (s instanceof NumberSetting n) {
            int sx = r - 120, sw = 80;
            double t = (n.get() - n.min()) / (n.max() - n.min());
            g.fill(sx, row.y + 8, sx + sw, row.y + 10, 0x40FFFFFF);
            g.fillGradient(sx, row.y + 8, sx + (int) (sw * t), row.y + 10, Theme.BLUE, Theme.VIOLET);
            int kx = sx + (int) (sw * t);
            g.fill(kx - 2, row.y + 4, kx + 2, row.y + 14, Theme.TEXT);
            g.drawString(font, n.display(), r - 34, row.y + 5, Theme.TEXT, false);
        } else if (s instanceof ModeSetting mode) {
            String v = "< " + mode.get() + " >";
            g.drawString(font, v, r - 8 - font.width(v), row.y + 5, Theme.BLUE, false);
        }
    }

    private void toggle(GuiGraphics g, int x, int y, boolean on) {
        g.fill(x, y, x + 24, y + 12, on ? Theme.BLUE : 0x50FFFFFF);
        int k = on ? x + 13 : x + 1;
        g.fill(k, y + 1, k + 10, y + 11, Theme.TEXT);
    }

    @Override public boolean mouseClicked(double mx, double my, int button) {
        if (super.mouseClicked(mx, my, button)) return true;
        int cy = py + 46;
        if (mx >= px + 6 && mx < px + SIDEBAR - 6) {
            Category[] cats = Category.values();
            for (int i = -1; i < cats.length; i++) {
                if (my >= cy && my < cy + 16) {
                    category = i < 0 ? null : cats[i];
                    scroll = 0;
                    return true;
                }
                cy += 18;
            }
        }
        if (mx < listLeft() || mx >= listRight() || my < listTop() || my >= listBottom()) return false;
        for (Row row : layout()) {
            if (my < row.y || my >= row.y + row.h) continue;
            int r = listRight();
            if (row.setting == null) {
                Module m = row.module;
                boolean onToggle = mx >= r - 38;
                if ((onToggle || button == 0 && m.settings().isEmpty()) && m.toggleable()) {
                    m.toggle();
                    Notifications.push(m.enabled() ? Notifications.Kind.SUCCESS : Notifications.Kind.INFO, m.name(), m.enabled() ? "Enabled" : "Disabled");
                } else if (button == 1 && m.toggleable()) {
                    m.toggle();
                } else if (!m.settings().isEmpty()) {
                    if (!expanded.remove(m.id())) expanded.add(m.id());
                    clampScroll();
                }
                return true;
            }
            Setting<?> s = row.setting;
            if (s instanceof BooleanSetting b) {
                b.toggle();
            } else if (s instanceof ModeSetting mode) {
                mode.cycle();
            } else if (s instanceof NumberSetting n) {
                dragging = n;
                dragX = r - 120;
                dragW = 80;
                updateDrag(mx);
            }
            return true;
        }
        return false;
    }

    private void updateDrag(double mx) {
        if (dragging == null) return;
        double t = Mth.clamp((mx - dragX) / dragW, 0, 1);
        dragging.set(dragging.min() + t * (dragging.max() - dragging.min()));
    }

    @Override public boolean mouseDragged(double mx, double my, int button, double dx, double dy) {
        if (dragging != null) {
            updateDrag(mx);
            return true;
        }
        return super.mouseDragged(mx, my, button, dx, dy);
    }

    @Override public boolean mouseReleased(double mx, double my, int button) {
        dragging = null;
        return super.mouseReleased(mx, my, button);
    }

    @Override public boolean mouseScrolled(double mx, double my, double sx, double sy) {
        scroll -= sy * 20;
        clampScroll();
        return true;
    }

    private void clampScroll() {
        int max = Math.max(0, contentHeight() - (listBottom() - listTop()));
        scroll = Mth.clamp(scroll, 0, max);
    }

    @Override public boolean keyPressed(int key, int scan, int mods) {
        if (!search.isFocused() && ZenithClient.get().menuKey().matches(key, scan)) {
            onClose();
            return true;
        }
        return super.keyPressed(key, scan, mods);
    }

    @Override protected void setInitialFocus() { setInitialFocus(search); }
}
