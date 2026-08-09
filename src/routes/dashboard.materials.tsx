import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { X, UploadCloud, FileText } from "lucide-react";
export const Route = createFileRoute("/dashboard/materials")({
  component: MaterialsDashboard,
});

type Material = {
  id: string;
  title: string;
  description: string;
  category: "past_questions" | "textbook" | "sample_questions" | "other";
  file_url: string;
  created_at: string;
};

const CATEGORIES = {
  past_questions: "Past Questions",
  textbook: "Textbooks",
  sample_questions: "Sample Questions",
  other: "Other",
};

function MaterialsDashboard() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadCategory, setUploadCategory] = useState<string>("past_questions");
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("course_materials" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setMaterials(data as Material[]);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim() || !user) return;
    
    setUploading(true);
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 10)}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(filePath, uploadFile);
        
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('materials')
        .getPublicUrl(filePath);
        
      const { error: dbError } = await supabase.from('course_materials' as any).insert({
        title: uploadTitle.trim(),
        description: uploadDesc.trim(),
        category: uploadCategory,
        file_url: publicUrl,
      });
      
      if (dbError) throw dbError;
      
      toast.success("Material uploaded successfully");
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadTitle("");
      setUploadDesc("");
      fetchMaterials();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const filteredMaterials = materials.filter(m => selectedCategory === "all" || m.category === selectedCategory);

  return (
    <div className="min-h-screen bg-surface">
      <SiteNav />
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
           <div>
             <h1 className="text-3xl font-bold">Course Materials</h1>
             <p className="mt-2 text-muted-foreground">Download past questions, textbooks, and sample questions to prepare for your exams.</p>
           </div>
           {(user?.role === "teacher" || user?.role === "admin") && (
             <button className="rounded-full bg-brand px-6 py-3 font-semibold text-primary-foreground hover:bg-brand/90 transition-all shadow-sm flex gap-2 items-center" onClick={() => setShowUploadModal(true)}>
               <UploadCloud className="size-4" />
               Upload Material
             </button>
           )}
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
           <button 
             onClick={() => setSelectedCategory("all")}
             className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${selectedCategory === "all" ? "bg-brand text-primary-foreground" : "bg-card text-ink border border-border hover:bg-secondary"}`}
           >
             All
           </button>
           {Object.entries(CATEGORIES).map(([key, label]) => (
             <button 
               key={key}
               onClick={() => setSelectedCategory(key)}
               className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${selectedCategory === key ? "bg-brand text-primary-foreground" : "bg-card text-ink border border-border hover:bg-secondary"}`}
             >
               {label}
             </button>
           ))}
        </div>

        {loading ? (
          <div className="mt-12 text-center text-muted-foreground">Loading materials...</div>
        ) : filteredMaterials.length === 0 ? (
          <div className="mt-12 rounded-3xl bg-secondary/50 p-12 text-center text-muted-foreground">
             No materials found for this category yet. Check back later!
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
             {filteredMaterials.map((material) => (
                <div key={material.id} className="flex flex-col justify-between rounded-3xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-all">
                   <div>
                      <div className="mb-3 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
                         {CATEGORIES[material.category as keyof typeof CATEGORIES]}
                      </div>
                      <h3 className="text-xl font-semibold leading-tight">{material.title}</h3>
                      {material.description && (
                        <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{material.description}</p>
                      )}
                   </div>
                   <div className="mt-6">
                      <a 
                        href={material.file_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-block w-full rounded-full bg-brand/10 py-3 text-center text-sm font-semibold text-brand hover:bg-brand hover:text-primary-foreground transition-colors"
                      >
                        Download PDF
                      </a>
                   </div>
                </div>
             ))}
          </div>
        )}
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-card shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="font-serif text-2xl font-bold">Upload Material</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-muted-foreground hover:text-ink">
                <X className="size-5" />
              </button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Select File</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer bg-secondary/30 border-border hover:bg-secondary/50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <UploadCloud className="size-8 text-muted-foreground mb-3" />
                      <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold text-brand">Click to upload</span> or drag and drop</p>
                      <p className="text-xs text-muted-foreground">PDF, DOCX, PNG, JPG (MAX. 10MB)</p>
                    </div>
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
                {uploadFile && (
                  <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-brand/5 border border-brand/20 text-sm">
                    <FileText className="size-4 text-brand" />
                    <span className="truncate flex-1 font-medium text-ink">{uploadFile.name}</span>
                    <button type="button" onClick={() => setUploadFile(null)} className="text-destructive hover:underline text-xs">Remove</button>
                  </div>
                )}
              </div>
              
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Title</label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="e.g. WASSCE 2022 Core Maths Past Questions"
                  className="mt-1 h-11 w-full rounded-xl border border-input bg-card px-4 text-sm focus:ring-1 focus:ring-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</label>
                <select
                  value={uploadCategory}
                  onChange={e => setUploadCategory(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-input bg-card px-4 text-sm focus:ring-1 focus:ring-brand focus:outline-none"
                >
                  {Object.entries(CATEGORIES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description (Optional)</label>
                <textarea
                  value={uploadDesc}
                  onChange={e => setUploadDesc(e.target.value)}
                  rows={3}
                  placeholder="Briefly describe what this material covers..."
                  className="mt-1 w-full rounded-xl border border-input bg-card p-4 text-sm focus:ring-1 focus:ring-brand focus:outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowUploadModal(false)} className="h-11 px-6 rounded-full font-semibold text-sm hover:bg-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={!uploadFile || !uploadTitle.trim() || uploading} className="h-11 px-8 rounded-full bg-brand text-primary-foreground font-semibold text-sm disabled:opacity-50 hover:bg-brand/90 transition-colors flex items-center gap-2">
                  {uploading ? (
                    <>
                      <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Uploading...
                    </>
                  ) : "Upload Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
