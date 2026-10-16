package dev.zenith.client.module.impl;

import dev.zenith.client.module.Category;
import dev.zenith.client.module.Module;
import dev.zenith.client.module.setting.NumberSetting;
import net.minecraft.client.Minecraft;

/** Caps the frame rate while the game window is unfocused to save CPU/GPU power. */
public final class DynamicFpsModule extends Module {
    private final NumberSetting unfocused = add(new NumberSetting("unfocused_fps", "Unfocused FPS cap", 15, 1, 60, 1));

    public DynamicFpsModule() { super("dynamicfps", "Dynamic FPS", "Limits FPS when the window is not focused", Category.PERFORMANCE, true); }

    /** Returns the cap to apply, or -1 to keep the vanilla limit. */
    public int limit(Minecraft mc) {
        if (!enabled()) return -1;
        if (!mc.isWindowActive()) return unfocused.intValue();
        return -1;
    }
}
