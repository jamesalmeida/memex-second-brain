import { processItem, ProcessItemParams } from './itemProcessingService';

interface QueuedItem {
  params: ProcessItemParams;
  resolve: (result: { itemId: string; success: boolean; error?: string; created: boolean }) => void;
  reject: (error: Error) => void;
}

/**
 * Sequential queue for processing items to prevent race conditions
 * when multiple URLs are shared or saved simultaneously
 */
class ItemProcessingQueue {
  private queue: QueuedItem[] = [];
  private processing = false;
  private processingUrls = new Set<string>(); // Track URLs being processed to prevent duplicates

  /**
   * Check if a URL is currently being processed
   */
  isProcessingUrl(url: string): boolean {
    return this.processingUrls.has(url.trim().toLowerCase());
  }

  /**
   * Check if any item is currently being processed
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Get the current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Enqueue an item for processing
   * Returns a promise that resolves when processing completes
   */
  async enqueue(params: ProcessItemParams): Promise<{ itemId: string; success: boolean; error?: string; created: boolean }> {
    const urlKey = params.url.trim().toLowerCase();

    // Check if this URL is already being processed
    if (this.processingUrls.has(urlKey)) {
      console.log(`⏸️ [ProcessingQueue] URL already being processed, skipping: ${params.url}`);
      // Find the item in the queue and return its promise
      const existingItem = this.queue.find(item => item.params.url.trim().toLowerCase() === urlKey);
      if (existingItem) {
        return new Promise((resolve, reject) => {
          // Wait for the existing item to complete
          existingItem.resolve = resolve;
          existingItem.reject = reject;
        });
      }
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        params,
        resolve,
        reject,
      });

      console.log(`📥 [ProcessingQueue] Enqueued item: ${params.url} (queue length: ${this.queue.length})`);

      // Start processing if not already running
      if (!this.processing) {
        this.processNext();
      }
    });
  }

  /**
   * Process the next item in the queue
   */
  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      console.log(`✅ [ProcessingQueue] Queue empty, processing stopped`);
      return;
    }

    this.processing = true;
    const item = this.queue.shift()!;
    const urlKey = item.params.url.trim().toLowerCase();

    // Mark URL as being processed
    this.processingUrls.add(urlKey);
    console.log(`🔄 [ProcessingQueue] Processing item: ${item.params.url} (${this.queue.length} remaining)`);

    try {
      const result = await processItem(item.params);
      
      // Remove from processing URLs set
      this.processingUrls.delete(urlKey);
      
      console.log(`✅ [ProcessingQueue] Completed processing: ${item.params.url} (success: ${result.success})`);
      item.resolve(result);
    } catch (error) {
      // Remove from processing URLs set
      this.processingUrls.delete(urlKey);
      
      console.error(`❌ [ProcessingQueue] Error processing item: ${item.params.url}`, error);
      item.reject(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      // Process next item in queue
      this.processNext();
    }
  }

  /**
   * Clear the queue (useful for cleanup or reset)
   */
  clear(): void {
    console.log(`🧹 [ProcessingQueue] Clearing queue (${this.queue.length} items)`);
    
    // Reject all pending items
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    
    this.queue = [];
    this.processingUrls.clear();
    this.processing = false;
  }
}

// Export singleton instance
export const itemProcessingQueue = new ItemProcessingQueue();

