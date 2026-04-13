import { useState } from "react";
import { Loader2, Sparkles, Maximize2, Eraser, Scissors, Download, Upload, Image as ImageIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MockupTab } from "./mockup/MockupTab";
import { UpscaleTab } from "./mockup/UpscaleTab";
import { InpaintTab } from "./mockup/InpaintTab";
import { SegmentTab } from "./mockup/SegmentTab";

export function ProductMockupPanel() {
  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-nexus-orange/10 flex items-center justify-center">
          <ImageIcon className="h-5 w-5 text-nexus-orange" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Promo Brindes — Estúdio de Imagens</h3>
          <p className="text-xs text-muted-foreground">
            Pipeline AI para fotografia de produto: mockup, upscale, inpaint e segmentação
          </p>
        </div>
      </div>
      <Tabs defaultValue="mockup" className="space-y-4">
        <TabsList className="bg-background">
          <TabsTrigger value="mockup" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Mockup
          </TabsTrigger>
          <TabsTrigger value="upscale" className="gap-1.5">
            <Maximize2 className="h-3.5 w-3.5" />
            Upscale
          </TabsTrigger>
          <TabsTrigger value="inpaint" className="gap-1.5">
            <Eraser className="h-3.5 w-3.5" />
            Inpaint
          </TabsTrigger>
          <TabsTrigger value="segment" className="gap-1.5">
            <Scissors className="h-3.5 w-3.5" />
            Segment
          </TabsTrigger>
        </TabsList>
        <TabsContent value="mockup"><MockupTab /></TabsContent>
        <TabsContent value="upscale"><UpscaleTab /></TabsContent>
        <TabsContent value="inpaint"><InpaintTab /></TabsContent>
        <TabsContent value="segment"><SegmentTab /></TabsContent>
      </Tabs>
    </div>
  );
}
