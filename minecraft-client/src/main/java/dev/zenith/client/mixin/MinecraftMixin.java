package dev.zenith.client.mixin;

import dev.zenith.client.ZenithClient;
import dev.zenith.client.gui.ZenithTitleScreen;
import dev.zenith.client.module.impl.ClientSettingsModule;
import dev.zenith.client.module.impl.DynamicFpsModule;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Minecraft.class)
public abstract class MinecraftMixin {
    @ModifyVariable(method = "setScreen", at = @At("HEAD"), argsOnly = true)
    private Screen zenith$replaceTitleScreen(Screen screen) {
        ZenithClient z = ZenithClient.get();
        if (screen instanceof TitleScreen && z != null && z.modules().get(ClientSettingsModule.class).customMenu.get()) {
            return new ZenithTitleScreen();
        }
        return screen;
    }

    @Inject(method = "getFramerateLimit", at = @At("RETURN"), cancellable = true)
    private void zenith$dynamicFps(CallbackInfoReturnable<Integer> cir) {
        ZenithClient z = ZenithClient.get();
        if (z == null) return;
        int limit = z.modules().get(DynamicFpsModule.class).limit((Minecraft) (Object) this);
        if (limit > 0 && limit < cir.getReturnValue()) cir.setReturnValue(limit);
    }
}
