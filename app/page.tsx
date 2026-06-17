/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Image } from "../types";
import NextImage from "next/image";
import {
  IconSearch,
  IconShare2,
  IconX,
  IconArrowRight,
  IconArrowLeft,
  IconInfoCircle,
  IconExternalLink,
  IconPhone,
  IconUser,
  IconMapPin,
  IconChevronRight,
  IconCheck,
  IconPackage,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { ShineBorder } from "@/components/ui/shine-border";
import { RainbowButton } from "@/components/ui/rainbow-button";

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

type SearchStep = "phone" | "name" | "address" | "results";

interface SearchState {
  step: SearchStep;
  phone: string;
  name: string;
  address: string;
  currentQuery: string;
  noResultsFor: SearchStep[];
}

const trackingSites = [
  {
    name: "DTDC Tracking",
    description: "Track your DTDC shipments",
    url: "https://www.dtdc.in/tracking.asp",
    logo: "dtdc.png",
    color: "bg-blue-50 border-blue-200",
    textColor: "text-blue-700",
  },
  {
    name: "India Post Tracking",
    description: "Track your India Post parcels",
    url: "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx",
    logo: "indiapost.jpeg",
    color: "bg-red-50 border-red-200",
    textColor: "text-red-700",
  },
];

const stepConfig = {
  phone: {
    icon: IconPhone,
    label: "Mobile number",
    placeholder: "Enter your 10-digit mobile number",
    hint: "This is the fastest way to find your package",
    inputMode: "numeric" as const,
    maxLength: 10,
  },
  name: {
    icon: IconUser,
    label: "Your name",
    placeholder: "Enter the name on the package",
    hint: "As written on the shipping label",
    inputMode: "text" as const,
    maxLength: 60,
  },
  address: {
    icon: IconMapPin,
    label: "Delivery address",
    placeholder: "Street, area, or city on the label",
    hint: "Any part of the address will work",
    inputMode: "text" as const,
    maxLength: 100,
  },
};

// Cache key for localStorage
const CACHE_KEY = 'package_search_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Image component with priority loading
const OptimizedImage = ({ 
  image, 
  onError, 
  onClick,
  priority = false
}: { 
  image: Image; 
  onError: (url: string) => void; 
  onClick: () => void;
  priority?: boolean;
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div
      onClick={onClick}
      className="group relative aspect-[3/4] bg-white rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow"
    >
      {!isLoaded && !error && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 animate-pulse" />
      )}
      
      {error ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <IconPackage className="w-8 h-8 text-gray-300 dark:text-gray-600" />
        </div>
      ) : (
        <NextImage
          width={200}
          height={267}
          src={image.url}
          alt={image.title || "Package label"}
          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoadingComplete={() => setIsLoaded(true)}
          onError={() => {
            setError(true);
            onError(image.url);
          }}
          loading={priority ? "eager" : "lazy"}
          priority={priority}
          quality={75}
          sizes="(max-width: 768px) 50vw, 33vw"
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k="
        />
      )}
      
      {(image as any).extractedData?.name && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
          <p className="text-white text-xs font-semibold truncate">{(image as any).extractedData.name}</p>
        </div>
      )}
    </div>
  );
};

export default function HomePage() {
  const [images, setImages] = useState<Image[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [showPopup, setShowPopup] = useState(false);

  const [searchState, setSearchState] = useState<SearchState>({
    step: "phone",
    phone: "",
    name: "",
    address: "",
    currentQuery: "",
    noResultsFor: [],
  });
  const [inputValue, setInputValue] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentStepConfig = stepConfig[searchState.step as keyof typeof stepConfig] ?? stepConfig.phone;

  useEffect(() => {
    if (inputRef.current) {
      // Slight delay to ensure DOM is ready
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [searchState.step]);

  useEffect(() => {
    if (hasSearched && searchState.currentQuery) {
      fetchImages();
    }
  }, [currentPage]);

  // Cancel previous requests
  const cancelPreviousRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Check cache
  const getCachedData = useCallback((key: string) => {
    const cached = cacheRef.current.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    cacheRef.current.delete(key);
    return null;
  }, []);

  const fetchImages = useCallback(async (query?: string) => {
    const q = query ?? searchState.currentQuery;
    if (!q.trim()) return;

    cancelPreviousRequest();
    
    const cacheKey = `${q}-page-${currentPage}`;
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      setImages(cachedData.images);
      setPagination(cachedData.pagination);
      setImageErrors(new Set());
      return;
    }

    setLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "12",
        search: q.trim(),
      });
      
      const response = await fetch(`/api/public/images?${params}`, {
        signal: abortControllerRef.current.signal,
        // Add cache control
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        const result = {
          images: data.data.images,
          pagination: data.data.pagination,
        };
        
        // Cache the result
        cacheRef.current.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
        });
        
        setImages(result.images);
        setPagination(result.pagination);
        setImageErrors(new Set());
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Failed to fetch images:", error);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [currentPage, searchState.currentQuery, cancelPreviousRequest, getCachedData]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      if (value.trim()) {
        handleSearch(value);
      }
    }, 300),
    []
  );

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;

    const step = searchState.step as "phone" | "name" | "address";
    const newState = { 
      ...searchState, 
      [step]: query.trim(), 
      currentQuery: query.trim() 
    };
    setSearchState(newState);
    setCurrentPage(1);
    setHasSearched(true);
    setLoading(true);

    cancelPreviousRequest();
    const cacheKey = `${query.trim()}-page-1`;
    const cachedData = getCachedData(cacheKey);

    if (cachedData) {
      setImages(cachedData.images);
      setPagination(cachedData.pagination);
      setImageErrors(new Set());
      setSearchState({ ...newState, step: "results" });
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "12",
        search: query.trim(),
      });
      
      abortControllerRef.current = new AbortController();
      const response = await fetch(`/api/public/images?${params}`, {
        signal: abortControllerRef.current.signal,
      });
      const data = await response.json();

      if (data.success && data.data.images.length > 0) {
        const result = {
          images: data.data.images,
          pagination: data.data.pagination,
        };
        
        cacheRef.current.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
        });
        
        setImages(result.images);
        setPagination(result.pagination);
        setImageErrors(new Set());
        setSearchState({ ...newState, step: "results" });
      } else {
        setImages([]);
        setPagination(null);
        const updatedNoResults = [...newState.noResultsFor, step];
        const next = getNextStep(step, updatedNoResults);
        if (next) {
          setSearchState({ ...newState, step: next, noResultsFor: updatedNoResults });
          setInputValue("");
        } else {
          setSearchState({ ...newState, step: "results", noResultsFor: updatedNoResults });
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Search failed:", error);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [searchState, cancelPreviousRequest, getCachedData]);

  const getNextStep = (
    current: "phone" | "name" | "address",
    noResults: SearchStep[]
  ): SearchStep | null => {
    const order: Array<"phone" | "name" | "address"> = ["phone", "name", "address"];
    const currentIdx = order.indexOf(current);
    for (let i = currentIdx + 1; i < order.length; i++) {
      if (!noResults.includes(order[i])) return order[i];
    }
    return null;
  };

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    debouncedSearch(inputValue.trim());
  }, [inputValue, debouncedSearch]);

  const resetSearch = useCallback(() => {
    cancelPreviousRequest();
    setSearchState({ 
      step: "phone", 
      phone: "", 
      name: "", 
      address: "", 
      currentQuery: "", 
      noResultsFor: [] 
    });
    setInputValue("");
    setImages([]);
    setPagination(null);
    setHasSearched(false);
    setCurrentPage(1);
    cacheRef.current.clear(); // Clear cache on reset
  }, [cancelPreviousRequest]);

  const trySavedValue = useCallback((step: "phone" | "name" | "address") => {
    const val = searchState[step];
    if (!val) return;
    setSearchState({ ...searchState, step, currentQuery: val });
    setInputValue(val);
    handleSearch(val);
  }, [searchState, handleSearch]);

  const handleImageError = useCallback((url: string) => {
    setImageErrors((prev) => new Set(prev.add(url)));
  }, []);

  const handleImageClick = useCallback((image: Image) => {
    setSelectedImage(image);
    setShowPopup(true);
  }, []);

  const closePopup = useCallback(() => {
    setShowPopup(false);
    setSelectedImage(null);
  }, []);

  const handleShare = useCallback(async () => {
    if (!selectedImage) return;
    try {
      if (navigator.share) {
        await navigator.share({ 
          title: selectedImage.title || "Document Image", 
          text: "Check out this document", 
          url: selectedImage.url 
        });
      } else {
        await navigator.clipboard.writeText(selectedImage.url);
        alert("Image URL copied to clipboard!");
      }
    } catch {}
  }, [selectedImage]);

  const openTrackingSite = useCallback((url: string) => {
    window.open(url, "_blank");
  }, []);

  const completedSteps = useMemo(() => 
    (["phone", "name", "address"] as const).filter(
      (s) => searchState[s] && s !== searchState.step
    ), [searchState]
  );

  const isSearching = searchState.step !== "results";

  return (
    <div className="min-h-screen bg-muted rounded-t-4xl">
      <div className="container mx-auto px-3 py-6 max-w-2xl">

        {/* Important note */}
        <div className="mb-5 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-3">
          <div className="flex gap-2">
            <IconInfoCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <p className="text-green-800 dark:text-green-300 text-xs font-medium tracking-tight">
              Package tracking IDs appear here <strong>24 hours</strong> after order confirmation.
            </p>
          </div>
        </div>

        {/* Smart search UI */}
        {isSearching && (
          <div className="mb-6">
            {/* Step breadcrumb */}
            <div className="flex items-center gap-1.5 mb-4 flex-wrap">
              {(["phone", "name", "address"] as const).map((s, i) => {
                const done = searchState[s] && s !== searchState.step;
                const active = s === searchState.step;
                const Ic = stepConfig[s].icon;
                return (
                  <div key={s} className="flex items-center gap-1.5">
                    <button
                      onClick={() => done ? trySavedValue(s) : undefined}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                        active
                          ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                          : done
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 cursor-pointer hover:bg-green-200"
                          : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600"
                      }`}
                    >
                      {done ? <IconCheck className="w-3 h-3" /> : <Ic className="w-3 h-3" />}
                      {stepConfig[s].label}
                    </button>
                    {i < 2 && <IconChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>

            {/* No-result hint from previous step */}
            {searchState.noResultsFor.length > 0 && (
              <div className="mb-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                <div className="flex gap-2">
                  <IconInfoCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-amber-800 dark:text-amber-300 text-xs font-semibold">
                      No package found with that {searchState.noResultsFor[searchState.noResultsFor.length - 1]}.
                    </p>
                    <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                      Let's try your {currentStepConfig.label.toLowerCase()} instead.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Main search card */}
            <div className="bg-background rounded-2xl shadow-sm border border-border overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  {(() => { const Ic = currentStepConfig.icon; return <Ic className="w-4 h-4 text-gray-500" />; })()}
                  <span className="text-sm font-semibold text-foreground">{currentStepConfig.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{currentStepConfig.hint}</p>
              </div>

              <form onSubmit={handleSubmit} className="px-4 pb-4">
                <div className="relative bg-muted rounded-xl">
                  <ShineBorder shineColor={["#A07CFE", "green", "#FFBE7B"]} />
                  <input
                    ref={inputRef}
                    type={searchState.step === "phone" ? "tel" : "text"}
                    inputMode={currentStepConfig.inputMode}
                    maxLength={currentStepConfig.maxLength}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={currentStepConfig.placeholder}
                    className="w-full px-4 py-3 bg-transparent text-sm font-medium placeholder:text-muted-foreground focus:outline-none pr-24 rounded-xl"
                    autoComplete="off"
                    autoFocus
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    {inputValue && (
                      <button 
                        type="button" 
                        onClick={() => setInputValue("")} 
                        className="p-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <IconX className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <Button 
                      type="submit" 
                      size="sm" 
                      disabled={!inputValue.trim() || loading} 
                      className="rounded-lg text-xs h-8"
                    >
                      {loading ? "…" : "Search"}
                    </Button>
                  </div>
                </div>

                {/* Skip option */}
                {searchState.noResultsFor.length === 0 && searchState.step !== "phone" && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = getNextStep(searchState.step as any, [...searchState.noResultsFor, searchState.step as any]);
                      if (next) { 
                        setSearchState({ ...searchState, step: next, noResultsFor: [...searchState.noResultsFor, searchState.step as any] }); 
                        setInputValue(""); 
                      }
                      else setSearchState({ ...searchState, step: "results" });
                    }}
                    className="mt-2 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 w-full text-center"
                  >
                    Skip — try next option
                  </button>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Results header when done */}
        {!isSearching && (
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold tracking-tight">Search Results</h2>
              {pagination && (
                <p className="text-xs text-muted-foreground">
                  {pagination.total} package{pagination.total !== 1 ? "s" : ""} found for &ldquo;{searchState.currentQuery}&rdquo;
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={resetSearch} className="text-xs gap-1 rounded-full">
              <IconSearch className="w-3 h-3" /> New search
            </Button>
          </div>
        )}

        {/* Loading skeleton with priority images */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div 
                key={i} 
                className="aspect-[3/4] bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        )}

        {/* Results grid */}
        {!loading && images.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {images.map((image, index) => (
                <OptimizedImage
                  key={image._id}
                  image={image}
                  onError={handleImageError}
                  onClick={() => handleImageClick(image)}
                  priority={index < 3} // Load first 3 images with priority
                />
              ))}
            </div>

            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
              <div className="flex gap-2">
                <IconInfoCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-yellow-800 dark:text-yellow-300 text-xs font-medium tracking-tight">
                  Use the tracking ID near the barcode on the label and track via DTDC.in or the courier shown on the package.
                </p>
              </div>
            </div>

            {pagination && pagination.pages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <button 
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} 
                  disabled={currentPage === 1} 
                  className="p-2 rounded-md border disabled:opacity-30 hover:bg-gray-50"
                >
                  <IconArrowLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => i + 1).map((page) => (
                  <button 
                    key={page} 
                    onClick={() => setCurrentPage(page)} 
                    className={`w-8 h-8 rounded-md text-sm ${
                      currentPage === page 
                        ? "bg-gray-900 text-white" 
                        : "border hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button 
                  onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))} 
                  disabled={currentPage === pagination.pages} 
                  className="p-2 rounded-md border disabled:opacity-30 hover:bg-gray-50"
                >
                  <IconArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* No results after all steps */}
        {!loading && images.length === 0 && searchState.step === "results" && (
          <div className="text-center py-10 bg-white dark:bg-gray-900 rounded-2xl border border-border">
            <div className="w-14 h-14 mx-auto mb-3 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <IconPackage className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-base font-bold tracking-tight mb-1">Package not found</h3>
            <div className="text-xs text-muted-foreground bg-muted rounded-xl mx-auto w-fit px-4 py-2 mb-4 text-left">
              <p className="font-semibold mb-1">Things to check:</p>
              <ul className="list-decimal list-inside space-y-0.5">
                <li>Verify phone number, name, and address</li>
                <li>New orders take up to 24 hours to appear</li>
                <li>Try again later</li>
              </ul>
            </div>
            <Button size="sm" onClick={resetSearch} className="rounded-full gap-1">
              <IconSearch className="w-3.5 h-3.5" /> Try again
            </Button>
          </div>
        )}

        {/* Tracking sites + store — show when not searching */}
        {!hasSearched && (
          <div className="mt-8">
            <h2 className="text-base font-bold tracking-tight mb-3 text-center">Tracking sites</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {trackingSites.map((site, i) => (
                <div 
                  key={i} 
                  onClick={() => openTrackingSite(site.url)} 
                  className="bg-background flex flex-col items-center rounded-xl p-4 cursor-pointer hover:shadow-md transition-all group hover:scale-105 border border-border"
                >
                  <div className="relative w-20 h-20 mb-2">
                    <NextImage 
                      src={`/${site.logo}`} 
                      alt={site.name} 
                      width={80} 
                      height={80} 
                      className="object-contain w-full h-full rounded-md" 
                      loading="lazy"
                    />
                    <IconExternalLink className={`absolute -top-1 -right-1 w-4 h-4 ${site.textColor} opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-0.5 border`} />
                  </div>
                  <p className="text-xs font-medium text-center text-muted-foreground">{site.name}</p>
                </div>
              ))}
            </div>
            <div className="bg-background rounded-xl border border-border p-4">
              <h3 className="text-sm font-bold text-green-800 dark:text-green-400 mb-1">New purchases</h3>
              <p className="text-xs text-muted-foreground mb-3">Visit our store for new orders</p>
              <RainbowButton className="rounded-lg w-full" onClick={() => window.open("https://deltagarage.in", "_blank")}>
                Visit deltagarage.in
              </RainbowButton>
            </div>
          </div>
        )}
      </div>

      {/* Image popup */}
      {showPopup && selectedImage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 z-50">
          <div className="relative bg-white dark:bg-gray-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-3">
              <div className="bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
                <h3 className="text-white font-semibold text-sm truncate max-w-[200px]">
                  {selectedImage.extractedData?.name || selectedImage.title}
                </h3>
              </div>
              <Button size="icon" onClick={closePopup} className="bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full">
                <IconX className="text-white w-4 h-4" />
              </Button>
            </div>
            <div className="w-full bg-gray-900 flex items-center justify-center min-h-[300px]">
              {imageErrors.has(selectedImage.url) ? (
                <div className="flex flex-col items-center py-16">
                  <IconPackage className="w-16 h-16 text-gray-500 mb-2" />
                  <p className="text-gray-400">Image not available</p>
                </div>
              ) : (
                <div className="relative w-full">
                  <NextImage
                    width={800}
                    height={600}
                    src={selectedImage.url}
                    alt={selectedImage.title || "Package label"}
                    className="w-full object-contain max-h-[80vh]"
                    onError={() => handleImageError(selectedImage.url)}
                    priority
                    quality={90}
                  />
                  <div className="absolute bottom-3 right-3">
                    <Button onClick={handleShare} size="sm" className="bg-black/50 rounded-full hover:bg-black/70 backdrop-blur-sm text-white border-0 gap-1.5">
                      <IconShare2 className="w-3.5 h-3.5" /> Share
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}