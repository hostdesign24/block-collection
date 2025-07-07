/**
 * FAQ Accordion Component for AEM - Rittal Style (Updated for Multiple Tags)
 */
export default function decorate(block) {
  const state = {
    faqItems: [], currentActiveAccordion: null, isInitialized: false, mutationObserver: null,
  };

  /**
   * Core utility functions
   */
  const utils = {
    isAuthorMode() {
      return window.location.pathname.includes('.html') || document.querySelector('.aem-AuthorLayer') !== null || document.body.classList.contains('editor') || window.location.href.includes('editor.html');
    },

    waitForAuthoring() {
      return new Promise((resolve) => {
        if (!this.isAuthorMode()) {
          resolve();
          return;
        }
        setTimeout(resolve, 800);
      });
    },

    /**
     * Extracts category name from the tag path
     * @param {string} tag - Tag path or identifier
     * @returns {string} Extracted category name
     */
    getTagName(tag) {
      if (!tag) return '';
      return tag.split('/').pop().split(':').pop().trim();
    },

    /**
     * Parses multiple tags from a single tag string (handles comma-separated tags)
     * @param {string} tagString - String containing one or more tags
     * @returns {Array} Array of individual tags
     */
    parseMultipleTags(tagString) {
      if (!tagString) return [];

      // Handle both comma-separated and space-separated tags
      const tags = tagString.split(/[,\s]+/)
        .map(tag => tag.trim())
        .filter(tag => tag && tag.includes('smart-x-com:'));

      return tags;
    },

    /**
     * Extracts all possible parent paths from a tag
     * @param {string} tag - Full tag path
     * @returns {Array} Array of all parent paths including the tag itself
     */
    extractAllPaths(tag) {
      if (!tag || !tag.includes('smart-x-com:')) return [];

      const paths = [];
      const parts = tag.split(':');
      if (parts.length < 2) return [];

      const tagPath = parts.slice(1).join(':');
      const pathSegments = tagPath.split('/').filter(segment => segment.trim());

      // Create all possible parent paths
      for (let i = 1; i <= pathSegments.length; i++) {
        const parentPath = pathSegments.slice(0, i).join('/');
        paths.push(`smart-x-com:${parentPath}`);
      }

      return paths;
    },

    /**
     * Parses hierarchical tags and builds a comprehensive tree structure
     * @param {Array} allTags - Array of all tag strings from all items
     * @returns {Object} Tree structure of tags
     */
    parseTagHierarchy(allTags) {
      const tagTree = {};
      const processedTags = new Set();
      const allPaths = new Set();

      // First pass: collect all possible paths from all tags
      allTags.forEach((tagString) => {
        const individualTags = this.parseMultipleTags(tagString);
        individualTags.forEach((tag) => {
          const paths = this.extractAllPaths(tag);
          paths.forEach(path => allPaths.add(path));
        });
      });

      // Second pass: build the hierarchy from all collected paths
      Array.from(allPaths).forEach((tag) => {
        if (!tag || processedTags.has(tag)) return;
        processedTags.add(tag);

        const parts = tag.split(':');
        if (parts.length < 2) return;

        const tagPath = parts.slice(1).join(':');
        const pathSegments = tagPath.split('/').filter((segment) => segment.trim());

        let currentLevel = tagTree;

        pathSegments.forEach((segment, index) => {
          const pathUpToHere = pathSegments.slice(0, index + 1).join('/');
          const fullPath = `smart-x-com:${pathUpToHere}`;

          if (!currentLevel[segment]) {
            currentLevel[segment] = {
              // eslint-disable-next-line max-len
              name: segment, fullPath, children: {}, count: 0, level: index, itemIds: new Set()
            };
          }

          currentLevel = currentLevel[segment].children;
        });
      });

      // Third pass: count items for each category
      state.faqItems.forEach((item, itemIndex) => {
        if (item.tags && item.tags.length > 0) {
          item.tags.forEach((tagString) => {
            const individualTags = this.parseMultipleTags(tagString);
            individualTags.forEach((tag) => {
              const paths = this.extractAllPaths(tag);
              paths.forEach((path) => {
                this.incrementTagCount(tagTree, path, item.id || `faq-${itemIndex}`);
              });
            });
          });
        }
      });

      return tagTree;
    },

    /**
     * Increments count for a specific tag path in the tree
     * @param {Object} tagTree - The tag tree structure
     * @param {string} targetPath - The path to increment
     * @param {string} itemId - ID of the item to add
     */
    incrementTagCount(tagTree, targetPath, itemId) {
      const parts = targetPath.split(':');
      if (parts.length < 2) return;

      const tagPath = parts.slice(1).join(':');
      const pathSegments = tagPath.split('/').filter((segment) => segment.trim());

      let currentLevel = tagTree;

      pathSegments.forEach((segment) => {
        if (currentLevel[segment]) {
          // eslint-disable-next-line no-plusplus
          currentLevel[segment].count++;
          currentLevel[segment].itemIds.add(itemId);
          currentLevel = currentLevel[segment].children;
        }
      });
    },

    /**
     * Gets all tags from FAQ items (flattened array of all individual tags)
     * @returns {Array} Array of all individual tags
     */
    getAllTags() {
      const allTags = [];
      state.faqItems.forEach((item) => {
        if (item.tags && item.tags.length > 0) {
          item.tags.forEach((tagString) => {
            const individualTags = this.parseMultipleTags(tagString);
            allTags.push(...individualTags);
          });
        }
      });
      return [...new Set(allTags)];
    },

    /**
     * Checks if an item matches a filter path (supports nested categories and multiple tags)
     * @param {Object} item - FAQ item object
     * @param {string} filterPath - Selected filter path
     * @returns {boolean} Whether the item matches
     */
    itemMatchesFilter(item, filterPath) {
      if (!item.tags || !filterPath) return false;

      // Check all tags of the item
      // eslint-disable-next-line no-restricted-syntax
      for (const tagString of item.tags) {
        const individualTags = this.parseMultipleTags(tagString);

        for (const tag of individualTags) {
          if (this.tagMatchesFilter(tag, filterPath)) {
            return true;
          }
        }
      }

      return false;
    },

    /**
     * Checks if a single tag matches a filter path (supports nested categories)
     * @param {string} itemTag - Single tag from FAQ item
     * @param {string} filterPath - Selected filter path
     * @returns {boolean} Whether the tag matches
     */
    tagMatchesFilter(itemTag, filterPath) {
      if (!itemTag || !filterPath) return false;

      const cleanItemTag = itemTag.trim();
      const cleanFilterPath = filterPath.trim();

      if (cleanItemTag === cleanFilterPath) return true;

      const getTagPath = (tag) => {
        const parts = tag.split(':');
        return parts.length > 1 ? parts.slice(1).join(':') : tag;
      };

      const itemPath = getTagPath(cleanItemTag);
      const filterPathPart = getTagPath(cleanFilterPath);

      if (itemPath.startsWith(filterPathPart)) {
        const remainder = itemPath.substring(filterPathPart.length);
        return remainder === '' || remainder.startsWith('/');
      }

      return false;
    },
  };

  /**
   * Content extraction with better selector handling
   */
  const contentExtractor = {
    async extractFAQData() {
      const existingItems = block.querySelectorAll('[data-aue-model="faq-accordion-item"], .faq-accordion > div:not([style="display: none;"])');

      state.faqItems = [];

      if (existingItems.length === 0) {
        return false;
      }

      // eslint-disable-next-line max-len
      return utils.isAuthorMode() ? this.extractAuthorModeData(existingItems) : this.extractProductionData(existingItems);
    },

    async extractProductionData(items) {
      const renderedItems = block.querySelectorAll('.faq-accordion-items .faq-item');
      if (renderedItems.length > 0) {
        for (let i = 0; i < renderedItems.length; i += 1) {
          const item = renderedItems[i];
          const question = item.querySelector('.faq-question')?.textContent.trim() || '';
          const answerContent = item.querySelector('.faq-answer')?.textContent.trim() || '';

          const tags = [];
          let answer = '';

          if (answerContent.startsWith('smart-x-com:')) {
            tags.push(answerContent);
            answer = 'Answer not available in production mode';
          } else {
            answer = answerContent;
          }

          state.faqItems.push({
            id: `faq-${i}`, question, answer, tags, category: tags.length > 0 ? utils.getTagName(tags[0]) : '',
          });
        }

        return true;
      }

      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];

        let question = '';
        let answer = '';
        const tags = [];

        const titleElement = item.querySelector('[data-aue-prop="accordion_title"]');
        if (titleElement) {
          question = titleElement.textContent.trim();
        }

        const descriptionElement = item.querySelector('[data-aue-prop="accordion_description"]');
        if (descriptionElement) {
          answer = descriptionElement.innerHTML;
        }

        const tagElement = item.querySelector('[data-aue-prop="tags"]');
        if (tagElement) {
          const tagValue = tagElement.textContent.trim();
          if (tagValue && tagValue.includes('smart-x-com:')) {
            // Parse multiple tags from the tag string
            const individualTags = utils.parseMultipleTags(tagValue);
            tags.push(...individualTags);
          }
        }

        if (!question || !answer) {
          const allDivs = item.querySelectorAll('div');

          allDivs.forEach((div) => {
            const pElements = div.querySelectorAll('p');

            pElements.forEach((p) => {
              const text = p.textContent.trim();

              if (text.includes('smart-x-com:')) {
                const individualTags = utils.parseMultipleTags(text);
                individualTags.forEach((tag) => {
                  if (!tags.includes(tag)) {
                    tags.push(tag);
                  }
                });
              } else if (text && !question && text.length > 10) {
                question = text;
              } else if (text && question && !answer && text.length > 10 && !text.includes('smart-x-com:')) {
                answer = text;
              }
            });
          });
        }

        if (question) {
          state.faqItems.push({
            id: `faq-${i}`,
            question,
            answer: answer || 'No answer provided',
            tags,
            category: tags.length > 0 ? utils.getTagName(tags[0]) : '',
          });
        }
      }

      return state.faqItems.length > 0;
    },

    async extractAuthorModeData(items) {
      let attempts = 0;
      const maxAttempts = 10;
      let currentItems = items;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => {
          setTimeout(resolve, 300);
        });

        const updatedItems = block.querySelectorAll('[data-aue-model="faq-accordion-item"]');

        if (updatedItems.length > currentItems.length) {
          currentItems = updatedItems;
          state.faqItems = [];
          state.isInitialized = false;
        }

        if (attempts > 2 && updatedItems.length === currentItems.length) {
          break;
        }

        attempts++;
      }

      state.faqItems = [];

      for (let i = 0; i < currentItems.length; i += 1) {
        const item = currentItems[i];

        const titleElement = item.querySelector('[data-aue-prop="accordion_title"]');
        const descriptionElement = item.querySelector('[data-aue-prop="accordion_description"]');
        const tagElement = item.querySelector('[data-aue-prop="tags"]');

        if (titleElement && descriptionElement) {
          const question = titleElement.textContent.trim();
          let answer = descriptionElement.innerHTML;

          const tags = [];
          if (tagElement) {
            const tagValue = tagElement.textContent.trim();
            if (tagValue && tagValue.includes('smart-x-com:')) {
              // Parse multiple tags from the tag string
              const individualTags = utils.parseMultipleTags(tagValue);
              tags.push(...individualTags);
            }
          }

          if (answer && question) {
            const plainAnswer = answer.replace(/<[^>]*>/g, ' ').trim();
            const normalizedQuestion = question.replace(/[?!.]/g, '').trim().toLowerCase();

            if (plainAnswer.toLowerCase().startsWith(normalizedQuestion)) {
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = answer;

              const firstElement = tempDiv.firstElementChild;
              // eslint-disable-next-line max-len
              if (firstElement && firstElement.textContent.trim().toLowerCase().startsWith(normalizedQuestion)) {
                firstElement.remove();
                answer = tempDiv.innerHTML;
              }
            }
          }

          state.faqItems.push({
            id: `faq-${i}`, question, answer, tags, category: tags.length > 0 ? utils.getTagName(tags[0]) : '',
          });
        }
      }

      return state.faqItems.length > 0;
    },
  };

  /**
   * UI Components with improved accessibility
   */
  const ui = {
    createAccordionItem(faq, index) {
      const accordionItem = document.createElement('div');
      accordionItem.className = 'faq-item';
      accordionItem.dataset.category = faq.category || '';
      accordionItem.dataset.id = faq.id || `faq-${index}`;

      if (faq.tags && faq.tags.length > 0) {
        // Store all individual tags
        const allIndividualTags = [];
        faq.tags.forEach((tagString) => {
          const individualTags = utils.parseMultipleTags(tagString);
          allIndividualTags.push(...individualTags);
        });

        accordionItem.dataset.tags = allIndividualTags.join(',');
        accordionItem.dataset.primaryTag = utils.getTagName(allIndividualTags[0]);

        // Store all possible category paths for easier filtering
        const allPaths = [];
        allIndividualTags.forEach((tag) => {
          const paths = utils.extractAllPaths(tag);
          allPaths.push(...paths);
        });
        accordionItem.dataset.allPaths = [...new Set(allPaths)].join(',');
      }

      const questionContainer = document.createElement('div');
      questionContainer.className = 'faq-question-container';
      questionContainer.setAttribute('role', 'button');
      questionContainer.setAttribute('aria-expanded', 'false');
      questionContainer.setAttribute('aria-controls', `faq-answer-${index}`);
      questionContainer.setAttribute('tabindex', '0');
      questionContainer.id = `faq-question-${index}`;


      const questionText = document.createElement('div');
      questionText.className = 'faq-question';
      questionText.textContent = faq.question;

      const toggleIcon = document.createElement('div');
      toggleIcon.className = 'faq-toggle-icon';
      toggleIcon.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      toggleIcon.setAttribute('aria-hidden', 'true');

      questionContainer.appendChild(questionText);
      questionContainer.appendChild(toggleIcon);

      let answerContainer = document.createElement('div');
      answerContainer.className = 'faq-answer-container';
      answerContainer.setAttribute('id', `faq-answer-${index}`);
      answerContainer.setAttribute('role', 'region');
      answerContainer.setAttribute('aria-labelledby', `faq-question-${index}`);

      const answerContent = document.createElement('div');
      answerContent.className = 'faq-answer';
      answerContent.innerHTML = faq.answer;

      answerContainer.appendChild(answerContent);

      const toggleAccordion = () => {
        answerContainer = accordionItem.querySelector('.faq-answer-container');

        const isActive = accordionItem.classList.contains('active');

        if (state.currentActiveAccordion && state.currentActiveAccordion !== accordionItem) {
          const previousAnswer = state.currentActiveAccordion.querySelector('.faq-answer-container');
          const prevToggleIcon = state.currentActiveAccordion.querySelector('.faq-toggle-icon');
          const prevQuestionContainer = state.currentActiveAccordion.querySelector('.faq-question-container');

          state.currentActiveAccordion.classList.remove('active');
          previousAnswer.style.height = `${previousAnswer.scrollHeight}px`;
          requestAnimationFrame(() => {
            previousAnswer.style.height = '0px';
          });

          previousAnswer.addEventListener('transitionend', () => {
            if (!state.currentActiveAccordion.classList.contains('active')) {
              previousAnswer.style.height = '';
            }
          }, { once: true });

          // Reset previous icon and ARIA
          if (prevToggleIcon) {
            prevToggleIcon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
          }
          if (prevQuestionContainer) {
            prevQuestionContainer.setAttribute('aria-expanded', 'false');
          }
        }


        if (!isActive) {
          accordionItem.classList.add('active');
          answerContainer.style.height = '0px'; // Start collapsed
          requestAnimationFrame(() => {
            answerContainer.style.height = `${answerContainer.scrollHeight}px`; // Animate open
          });
        } else {
          answerContainer.style.height = `${answerContainer.scrollHeight}px`; // Start expanded
          requestAnimationFrame(() => {
            answerContainer.style.height = '0px'; // Animate close
          });
          accordionItem.classList.remove('active');
        }

        answerContainer.addEventListener('transitionend', () => {
          if (!accordionItem.classList.contains('active')) {
            answerContainer.style.height = '';
          }
        }, { once: true });

        toggleIcon.innerHTML = isActive ? ` <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>` : ` <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>`;
        questionContainer.setAttribute('aria-expanded', !isActive);
        state.currentActiveAccordion = !isActive ? accordionItem : null;
      };


      questionContainer.addEventListener('click', toggleAccordion);
      questionContainer.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13 || e.keyCode === 32) {
          e.preventDefault();
          toggleAccordion();
        }
      });

      accordionItem.appendChild(questionContainer);
      accordionItem.appendChild(answerContainer);


      return accordionItem;
    },

    createSearchBox() {
      const searchContainer = document.createElement('div');
      searchContainer.className = 'faq-search-container';

      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'faq-search-input';
      searchInput.placeholder = 'Search the FAQs';
      searchInput.setAttribute('aria-label', 'Search the FAQs');

      const searchIcon = document.createElement('div');
      searchIcon.className = 'faq-search-icon';
      searchIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="60" height="60" viewBox="0,0,256,256"
style="fill:#FFFFFF;">
<g fill="#ffffff" fill-rule="nonzero" stroke="none" stroke-width="1" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0" font-family="none" font-weight="none" font-size="none" text-anchor="none" style="mix-blend-mode: normal"><g transform="scale(5.33333,5.33333)"><path d="M20.5,6c-7.99037,0 -14.5,6.50964 -14.5,14.5c0,7.99036 6.50963,14.5 14.5,14.5c3.45636,0 6.63371,-1.22096 9.12891,-3.25l9.81055,9.81055c0.37623,0.39185 0.9349,0.54969 1.46055,0.41265c0.52565,-0.13704 0.93616,-0.54754 1.07319,-1.07319c0.13704,-0.52565 -0.0208,-1.08432 -0.41265,-1.46055l-9.81055,-9.81055c2.02904,-2.4952 3.25,-5.67255 3.25,-9.12891c0,-7.99036 -6.50963,-14.5 -14.5,-14.5zM20.5,9c6.36905,0 11.5,5.13096 11.5,11.5c0,3.10261 -1.2238,5.90572 -3.20898,7.9707c-0.12237,0.08994 -0.23037,0.19794 -0.32031,0.32031c-2.06499,1.98518 -4.86809,3.20898 -7.9707,3.20898c-6.36905,0 -11.5,-5.13096 -11.5,-11.5c0,-6.36904 5.13095,-11.5 11.5,-11.5z"></path></g></g>
</svg>
      `;
      searchIcon.setAttribute('aria-hidden', 'true');

      const suggestionsList = document.createElement('div');
      suggestionsList.className = 'faq-suggestions';
      suggestionsList.style.display = 'none';
      suggestionsList.setAttribute('role', 'listbox');

      searchContainer.appendChild(searchInput);
      searchContainer.appendChild(searchIcon);
      searchContainer.appendChild(suggestionsList);

      const performSearch = () => {
        const query = searchInput.value.trim();
        this.filterFAQs(query);
        suggestionsList.style.display = 'none';
      };

      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query === '') {
          this.filterFAQs('');
          suggestionsList.style.display = 'none';
          return;
        }

        searchTimeout = setTimeout(() => {
          if (query.length >= 4) {
            const suggestions = this.getSuggestions(query);
            this.showSuggestions(suggestions, suggestionsList, searchInput);
          } else {
            suggestionsList.style.display = 'none';
          }
        }, 200);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.keyCode === 13) {
          e.preventDefault();
          performSearch();
        }
      });

      searchIcon.addEventListener('click', () => {
        performSearch();
      });

      document.addEventListener('click', (e) => {
        if (!searchContainer.contains(e.target)) {
          suggestionsList.style.display = 'none';
        }
      });

      return searchContainer;
    },

    getSuggestions(query) {
      if (!query || query.length < 2) return [];

      const suggestions = new Set();
      const regex = new RegExp(query, 'i');

      state.faqItems.forEach((item) => {
        const questionWords = item.question.split(/\s+/)
          .filter((word) => word.length >= 2)
          .map((word) => word.replace(/[.,?!;:()]/g, '').trim());

        const plainAnswer = item.answer.replace(/<[^>]*>/g, ' ');
        const answerWords = plainAnswer.split(/\s+/)
          .filter((word) => word.length >= 2)
          .map((word) => word.replace(/[.,?!;:()]/g, '').trim());

        [...questionWords, ...answerWords].forEach((word) => {
          if (word.length >= 4 && regex.test(word)) {
            suggestions.add(word);
          }
        });

        if (regex.test(item.question) && item.question.length < 70) {
          suggestions.add(item.question);
        }
      });

      return Array.from(suggestions).slice(0, 5);
    },

    showSuggestions(suggestions, container, input) {
      container.innerHTML = '';

      if (suggestions.length === 0) {
        container.style.display = 'none';
        return;
      }

      container.style.display = 'block';

      suggestions.forEach((suggestion) => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'faq-suggestion-item';
        suggestionItem.textContent = suggestion;
        suggestionItem.setAttribute('role', 'option');

        suggestionItem.addEventListener('click', () => {
          input.value = suggestion;
          container.style.display = 'none';
          this.filterFAQs(suggestion);
        });

        container.appendChild(suggestionItem);
      });
    },

    filterFAQs(query) {
      if (!query) {
        this.showAllFAQs();
        return;
      }

      // Clear all dropdown selections when searching
      const dropdowns = block.querySelectorAll('.faq-filter-dropdown');
      dropdowns.forEach((dropdown) => {
        const display = dropdown.querySelector('.faq-filter-display');
        const displayText = dropdown.querySelector('.faq-filter-text');
        const level = parseInt(dropdown.dataset.level, 10);

        if (displayText) {
          displayText.textContent = level === 0 ? 'Select a category' : 'Select subcategory';
        }
        display.className = 'faq-filter-display placeholder';
        dropdown.classList.remove('has-selection', 'open');
      });

      const accordionItems = block.querySelectorAll('.faq-item');
      let visibleCount = 0;
      const lowercaseQuery = query.toLowerCase();

      accordionItems.forEach((item) => {
        const question = item.querySelector('.faq-question')?.textContent.toLowerCase() || '';
        const answer = item.querySelector('.faq-answer')?.textContent.toLowerCase() || '';

        if (question.includes(lowercaseQuery) || answer.includes(lowercaseQuery)) {
          item.style.display = 'block';
          visibleCount++;
        } else {
          item.style.display = 'none';
        }
      });

      this.updateNoResultsMessage(visibleCount);
    },

    filterFAQsByTag(selectedTagPath) {
      const accordionItems = block.querySelectorAll('.faq-item');
      let visibleCount = 0;

      accordionItems.forEach((item) => {
        const allPaths = item.dataset.allPaths ? item.dataset.allPaths.split(',') : [];

        // Check if any of the item's paths match the selected filter
        const shouldShow = allPaths.some(path => utils.tagMatchesFilter(path.trim(), selectedTagPath));

        if (shouldShow) {
          item.style.display = 'block';
          visibleCount++;
        } else {
          item.style.display = 'none';
        }
      });

      this.updateNoResultsMessage(visibleCount);
    },

    showAllFAQs() {
      const accordionItems = block.querySelectorAll('.faq-item');
      accordionItems.forEach((item) => {
        item.style.display = 'block';
      });

      // Clear all dropdown selections
      const dropdowns = block.querySelectorAll('.faq-filter-dropdown');
      dropdowns.forEach((dropdown) => {
        const display = dropdown.querySelector('.faq-filter-display');
        const displayText = dropdown.querySelector('.faq-filter-text');
        const level = parseInt(dropdown.dataset.level, 10);

        if (displayText) {
          displayText.textContent = level === 0 ? 'Select a category' : 'Select subcategory';
        }
        display.className = 'faq-filter-display placeholder';
        dropdown.classList.remove('has-selection', 'open');
      });

      this.updateNoResultsMessage(accordionItems.length);
    },

    updateNoResultsMessage(visibleCount) {
      let noResultsMsg = block.querySelector('.faq-no-results');

      if (visibleCount === 0) {
        if (!noResultsMsg) {
          noResultsMsg = document.createElement('div');
          noResultsMsg.className = 'faq-no-results';
          noResultsMsg.textContent = 'No results found.';
          block.querySelector('.faq-accordion-items')?.appendChild(noResultsMsg);
        }
        noResultsMsg.style.display = 'block';
      } else if (noResultsMsg) {
        noResultsMsg.style.display = 'none';
      }
    },

    createHierarchicalTagFilter() {
      const allTags = utils.getAllTags();
      const tagTree = utils.parseTagHierarchy(allTags);

      const filterContainer = document.createElement('div');
      filterContainer.className = 'faq-hierarchical-filter-container';

      const filterWrapper = document.createElement('div');
      filterWrapper.className = 'faq-filter-levels';

      this.createFilterLevel(tagTree, filterWrapper, 0, '');

      filterContainer.appendChild(filterWrapper);
      return filterContainer;
    },

    createFilterLevel(tagData, parentContainer, level, parentPath) {
      const levelContainer = document.createElement('div');
      levelContainer.className = `faq-filter-level faq-filter-level-${level}`;

      const dropdown = document.createElement('div');
      dropdown.className = 'faq-filter-dropdown';
      dropdown.dataset.level = level;

      // Create display area
      const display = document.createElement('button');
      display.type = 'button';
      display.className = 'faq-filter-display placeholder';

      // Create text span
      const displayText = document.createElement('span');
      displayText.className = 'faq-filter-text';
      displayText.textContent = level === 0 ? 'Select a category' : 'Select subcategory';

      // Create controls container
      const controls = document.createElement('div');
      controls.className = 'faq-filter-controls';

      // Create clear button (X)
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'faq-filter-clear';
      clearBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="50" height="50">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      clearBtn.setAttribute('aria-label', 'Clear selection');

      // Create dropdown arrow
      const arrow = document.createElement('span');
      arrow.className = 'faq-filter-arrow';
      arrow.innerHTML = `
       <svg xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" image-rendering="optimizeQuality" fill-rule="evenodd" clip-rule="evenodd" viewBox="0 0 512 266.77">
       <path fill-rule="nonzero" d="M493.12 3.22c4.3-4.27 11.3-4.3 15.62-.04a10.85 10.85 0 0 1 .05 15.46L263.83 263.55c-4.3 4.28-11.3 4.3-15.63.05L3.21 18.64a10.85 10.85 0 0 1 .05-15.46c4.32-4.26 11.32-4.23 15.62.04L255.99 240.3 493.12 3.22z"/></svg>
      `;

      controls.appendChild(clearBtn);
      controls.appendChild(arrow);

      display.appendChild(displayText);
      display.appendChild(controls);

      // Create options container
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'faq-filter-options';

      // Add options - only show categories that have items
      const sortedKeys = Object.keys(tagData)
        .filter(key => tagData[key].count > 0) // Only show categories with items
        .sort();

      sortedKeys.forEach((key) => {
        const tagInfo = tagData[key];
        const option = document.createElement('div');
        option.className = 'faq-filter-option';
        option.textContent = `${tagInfo.name}`;
        option.dataset.path = tagInfo.fullPath;
        option.dataset.hasChildren = Object.keys(tagInfo.children).length > 0;
        option.dataset.level = tagInfo.level;


        option.addEventListener('click', (e) => {
          const options = optionsContainer.querySelectorAll('.faq-filter-option');
          options.forEach(opt => opt.classList.remove('selected-option'));
          option.classList.add('selected-option');
          e.stopPropagation();

          const selectedPath = option.dataset.path;
          const hasChildren = option.dataset.hasChildren === 'true';

          // Update display
          displayText.textContent = tagInfo.name;
          display.className = 'faq-filter-display selected';
          dropdown.classList.add('has-selection');
          dropdown.classList.remove('open');

          // Remove deeper level dropdowns
          this.removeDeeperlevelDropdowns(level);

          // Filter FAQs
          this.filterFAQsByTag(selectedPath);

          // Create child dropdown if needed and make it visible
          if (hasChildren) {
            const selectedTagData = this.findTagDataByPath(tagData, selectedPath);
            if (selectedTagData && Object.keys(selectedTagData.children).length > 0) {
              this.createFilterLevel(selectedTagData.children, parentContainer, level + 1, selectedPath);

              // Make the new level visible
              setTimeout(() => {
                const newLevel = parentContainer.querySelector(`.faq-filter-level-${level + 1}`);
                if (newLevel) {
                  const newDropdown = newLevel.querySelector('.faq-filter-dropdown');
                  if (newDropdown) {
                    newDropdown.style.display = 'block';
                  }
                }
              }, 50);
            }
          }
        });

        optionsContainer.appendChild(option);
      });

      // Toggle dropdown on display click
      display.addEventListener('click', (e) => {
        e.stopPropagation();

        // Close other dropdowns
        const otherDropdowns = block.querySelectorAll('.faq-filter-dropdown.open');
        otherDropdowns.forEach(dd => {
          if (dd !== dropdown) dd.classList.remove('open');
        });

        // Toggle current dropdown
        dropdown.classList.toggle('open');
      });

      // Clear selection
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const options = optionsContainer.querySelectorAll('.faq-filter-option');
        options.forEach(opt => opt.classList.remove('selected-option'));
        dropdown.classList.remove('has-selection');

        // Reset display
        displayText.textContent = level === 0 ? 'Select a category' : 'Select subcategory';
        display.className = 'faq-filter-display placeholder';
        dropdown.classList.remove('has-selection', 'open');

        // Remove deeper level dropdowns
        this.removeDeeperlevelDropdowns(level);

        // Show all FAQs if clearing top level, otherwise filter by parent
        if (level === 0) {
          this.showAllFAQs();
        } else {
          // Re-filter by parent category
          const parentDropdown = parentContainer.querySelector(`.faq-filter-level-${level - 1} .faq-filter-dropdown.has-selection`);
          if (parentDropdown) {
            const parentText = parentDropdown.querySelector('.faq-filter-text');
            if (parentText) {
              // Find parent path and re-filter
              const options = parentDropdown.querySelectorAll('.faq-filter-option');
              options.forEach(opt => {
                if (opt.textContent.startsWith(parentText.textContent)) {
                  this.filterFAQsByTag(opt.dataset.path);
                }
              });
            }
          }
        }
      });

      dropdown.appendChild(display);
      dropdown.appendChild(optionsContainer);
      levelContainer.appendChild(dropdown);
      parentContainer.appendChild(levelContainer);

      // Make sure first level is always visible
      if (level === 0) {
        dropdown.style.display = 'block';
      }

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
          dropdown.classList.remove('open');
        }
      });
    },

    findTagDataByPath(tagData, targetPath) {
      for (const key in tagData) {
        const tagInfo = tagData[key];
        if (tagInfo.fullPath === targetPath) {
          return tagInfo;
        }
      }

      for (const key in tagData) {
        const tagInfo = tagData[key];
        if (targetPath.startsWith(tagInfo.fullPath)) {
          const result = this.findTagDataByPath(tagInfo.children, targetPath);
          if (result) return result;
        }
      }

      return null;
    },

    removeDeeperlevelDropdowns(keepLevel) {
      const filterLevels = block.querySelectorAll('.faq-filter-level');
      filterLevels.forEach((levelElement) => {
        const dropdown = levelElement.querySelector('.faq-filter-dropdown');
        if (dropdown) {
          const dropdownLevel = parseInt(dropdown.dataset.level, 10);
          if (dropdownLevel > keepLevel) {
            levelElement.remove();
          }
        }
      });
    },

    renderComponent() {
      if (state.faqItems.length === 0 || state.isInitialized) {
        return;
      }

      if (utils.isAuthorMode()) {
        const authorElements = block.querySelectorAll('[data-aue-model], [data-aue-prop]');
        if (authorElements.length > 0) {
          Array.from(block.children).forEach((child) => {
            if (!child.classList.contains('faq-accordion-enhanced')) {
              child.style.display = 'none';
            }
          });
        }
      } else {
        block.innerHTML = '';
      }

      const faqContainer = document.createElement('div');
      faqContainer.className = 'faq-accordion-enhanced';

      const controlsContainer = document.createElement('div');
      controlsContainer.className = 'faq-controls';

      const filtersWrapper = document.createElement('div');
      filtersWrapper.className = 'faq-filters-wrapper';

      const hierarchicalFilter = this.createHierarchicalTagFilter();
      filtersWrapper.appendChild(hierarchicalFilter);

      controlsContainer.appendChild(filtersWrapper);

      const searchBox = this.createSearchBox();
      controlsContainer.appendChild(searchBox);

      faqContainer.appendChild(controlsContainer);

      const accordionContainer = document.createElement('div');
      accordionContainer.className = 'faq-accordion-items';

      state.faqItems.forEach((faq, index) => {
        const accordionItem = this.createAccordionItem(faq, index);
        accordionContainer.appendChild(accordionItem);
      });

      faqContainer.appendChild(accordionContainer);
      block.appendChild(faqContainer);

      state.isInitialized = true;
    },
  };

  /**
   * Initialize the component
   */
  async function init() {
    try {
      await utils.waitForAuthoring();

      if (!utils.isAuthorMode()) {
        const allItems = block.querySelectorAll('.faq-accordion > div');
        allItems.forEach((item) => {
          item.style.display = '';
        });
      }

      if (utils.isAuthorMode() && !state.mutationObserver) {
        state.mutationObserver = new MutationObserver((mutations) => {
          let shouldReinitialize = false;

          mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
              mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && (node.hasAttribute('data-aue-model') || node.querySelector('[data-aue-model="faq-accordion-item"]'))) {
                  shouldReinitialize = true;
                }
              });
            }
          });

          if (shouldReinitialize) {
            state.isInitialized = false;
            setTimeout(() => {
              reinitialize();
            }, 500);
          }
        });

        state.mutationObserver.observe(block, {
          childList: true, subtree: true, attributes: false
        });
      }

      await performInitialization();
    } catch (error) {
      console.error('Error initializing FAQ component:', error);
    }
  }

  /**
   * Perform the actual initialization logic
   */
  async function performInitialization() {
    const hasData = await contentExtractor.extractFAQData();

    if (hasData) {
      setTimeout(() => {
        ui.renderComponent();
      }, utils.isAuthorMode() ? 500 : 100);
    }
  }

  /**
   * Reinitialize the component (used by mutation observer)
   */
  async function reinitialize() {
    if (state.isInitialized) {
      const enhanced = block.querySelector('.faq-accordion-enhanced');
      if (enhanced) {
        enhanced.remove();
      }
      state.isInitialized = false;
    }

    await performInitialization();
  }

  init();
}
