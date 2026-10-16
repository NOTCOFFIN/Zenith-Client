package dev.zenith.client.mixin;

import dev.zenith.client.ZenithClient;
import dev.zenith.client.module.impl.ZoomModule;
import net.minecraft.client.Camera;
import net.minecraft.client.renderer.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(GameRenderer.class)
public abstract class GameRendererMixin {
    @Inject(method = "getFov", at = @At("RETURN"), cancellable = true)
    private void zenith$zoom(Camera camera, float partialTick, boolean useFovSetting, CallbackInfoReturnable<Double> cir) {
        if (!useFovSetting) return;
        ZenithClient z = ZenithClient.get();
        if (z == null) return;
        double divisor = z.modules().get(ZoomModule.class).divisor(partialTick);
        if (divisor > 1.0001) cir.setReturnValue(cir.getReturnValue() / divisor);
    }
}
