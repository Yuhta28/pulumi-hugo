import algoliasearch from "algoliasearch/lite";
import { autocomplete, getAlgoliaResults, getAlgoliaFacets } from "@algolia/autocomplete-js";
import { createTagsPlugin } from "@algolia/autocomplete-plugin-tags";
import { createLocalStorageRecentSearchesPlugin } from '@algolia/autocomplete-plugin-recent-searches';


// TODO: Global namespace, bro.
const appID = "1174010HRV";
const publicApiKey = "7df9037684fa87409111b2c75ae565bb";
const searchClient = algoliasearch(appID, publicApiKey);
const autocompleteContainer = "#autocomplete";

window.addEventListener("DOMContentLoaded", () => {

    const initialQuery = new URL(window.location.href).searchParams.get("search");

    if (document.querySelector(autocompleteContainer)) {
        initAutocomplete(autocompleteContainer, initialQuery);
    }
});

window.addEventListener("keydown", (event: KeyboardEvent) => {
    if ((event.key.toLowerCase() === "k" && event.metaKey) || event.key === "/") {
        event.preventDefault();

        const input = document
            .querySelector(autocompleteContainer)
            .querySelector("input[type='search']") as HTMLInputElement;

        input.focus();
    }
});

function mapToAlgoliaFilters(tagsByFacet, operator = "AND") {
    const result = Object
        .keys(tagsByFacet)
        .map(facet => {
            return `(${tagsByFacet[facet]
                .map(({ label }) => `${facet}:"${label}"`)
                .join(' OR ')})`;
        })
        .join(` ${operator} `);

    // console.log({ result });
    return result;
}

function groupBy(items, predicate) {
    return items.reduce((acc, item) => {
        const key = predicate(item);

        if (!acc.hasOwnProperty(key)) {
            acc[key] = [];
        }

        acc[key].push(item);
        return acc;
    }, {});
}

function getTags(state) {
    return state.context?.tagsPlugin?.tags || [];
}

function setTags(state, tags) {
    state.context?.tagsPlugin?.setTags(tags);
}

function iconForTag(section) {
    switch(section) {
        case "Docs":
            return "fas fa-book-open";
    }

    return "";
}

function initAutocomplete(container, initialQuery) {

    const recentSearchesPlugin = createLocalStorageRecentSearchesPlugin({
        key: 'RECENT_SEARCH',
        limit: 5,
    });

    const baseTags = [
        {
            label: "Docs",
            facet: "section",
        },
        {
            label: "Registry",
            facet: "section",
        },
        {
            label: "Blog",
            facet: "section",
        },
        // {
        //     label: "Templates",
        //     facet: "section",
        // },
    ];

    const tagsPlugin = createTagsPlugin({
        initialTags: baseTags,
        transformSource: ({ source }) => {
            return undefined;
        },
        getTagsSubscribers: () => {
            return [
                {
                    sourceId: "section",
                    getTag: ({ item }) => {
                        return item;
                    },
                },
            ];
        }
    });

    const ac = autocomplete({
        container,
        openOnFocus: false,
        placeholder: "Search (⌘/ctrl+K or /)",
        initialState: {
            query: initialQuery,
        },
        onStateChange: ({ state, prevState, refresh, setContext }) => {
            // if (state.query?.trim() === "") {
            //     setTags(state, baseTags);
            // }
        },

        // onReset: ({ refresh, state }) => {
        //     console.log("onReset");
        //     refresh();
        // },
        // reshape: ({ sources, state, }) => {
        //     return sources
        //         .filter(source => {
        //             return source.sourceId === "results";
        //         });
        // },
        getSources: ({ query, state, setCollections, setQuery, refresh, setContext }) => {
            return [
                {
                    sourceId: "sections",
                    getItems: ({  }) => {
                        return getAlgoliaFacets({
                            searchClient,
                            queries: [
                                {
                                    indexName: "pulumi",
                                    facet: "section",
                                    params: {
                                        query,
                                        filters: mapToAlgoliaFilters(
                                            groupBy(
                                                (state.context.tagsPlugin as any).tags,
                                                (tag: any) => {
                                                    return tag.facet as string;
                                                },
                                            ),
                                        ),
                                    },
                                },
                            ],
                            transformResponse({ facetHits, hits, results }) {
                                // console.log({ facetHits, hits, results });
                                setContext({
                                    facetHits,
                                })
                                return [];
                            }
                        })
                    },
                    templates: {
                        item: () => null,
                    },
                },
                {
                    sourceId: "results",
                    getItems: ({ state }) => {
                        // console.log({ state });
                        return getAlgoliaResults({
                            searchClient,
                            queries: [
                                {
                                    indexName: "pulumi",
                                    query,
                                    params: {
                                        filters: mapToAlgoliaFilters(
                                            groupBy(
                                                (state.context.tagsPlugin as any).tags,
                                                (tag: any) => {
                                                    return tag.facet as string;
                                                },
                                            ),
                                        ),
                                        hitsPerPage: 20,
                                    },
                                },
                            ],
                        })
                    },
                    getItemUrl: ({ item, state }) => {
                        const url = new URL([document.location.origin, item.href].join(""));
                        return url.toString();
                    },
                    templates: {
                        header: ({ items, html, state }) => {

                            const matchingTags = baseTags
                                .filter(tag => items.find(item => item.section === tag.label))
                                .map(tag => {
                                    return {
                                        ...tag,
                                        count: items.filter(item => item.section === tag.label).length,
                                    };
                                });

                            const facetHits = state.context.facetHits[0] as any[];

                            return html`
                                <ul class="header">
                                    <li class="${ getTags(state).length === baseTags.length ? "active" : "" }">
                                        <button
                                            onclick="${ event => {
                                                event.stopPropagation();
                                                setTags(state, baseTags);
                                                refresh();
                                            }}">
                                            <i class="section-all"></i>
                                            <span class="label">All results</span>
                                            <span class="count">
                                                ${ facetHits.reduce((acc, f) => acc + f.count, 0) }
                                            </span>
                                        </button>
                                    </li>
                                    ${ baseTags.map(tag => {
                                        const facetHit = facetHits.find(f => f.label === tag.label);

                                        return html`
                                            <li class="${ getTags(state).length === 1 && getTags(state)[0].label === tag.label ? "active" : "" }">
                                                <button
                                                    onclick="${ event => {
                                                        event.stopPropagation();
                                                        setTags(state, [ { label: tag.label, facet: "section" } ]);
                                                        refresh();
                                                    }}">
                                                    <i class="section-${ tag.label.toLowerCase() }"></i>
                                                    <span class="label">${ tag.label }</span>
                                                    <span class="count">${ facetHit ? facetHit.count : 0 }</span>
                                                </button>
                                            </li>`
                                    })}
                                </ul>
                            `
                        },
                        item: ({ item, components, html }) => {
                            // console.log("item", { item });
                            return html`
                                <div class="result my-3 px-1">
                                    <a class="container" href="${ item.href }">
                                        <div class="ancestors">${ ((item.ancestors || []) as string[]).join(" / ") }</div>
                                        <div class="item">
                                            <div class="title">
                                                ${ components.Highlight({ hit: item, attribute: "title" }) }
                                            </div>
                                            <div class="description">
                                                ${ components.Highlight({ hit: item, attribute: "description" }) }
                                            </div>

                                        </div>
                                    </a>
                                </div>
                            `;
                        },
                        noResults: ({ html, state }) => {
                            return html`
                                <img src="/images/search/no-results.svg"/>
                                <p>We couldn't find any results for <mark>${ state.query }</mark>.</p>
                            `;
                        },
                        // footer: ({ state, components, html }) => {
                        //     return html`
                        //         <div class="my-2 mx-0.5 pt-4 border-t border-gray-300 px-1">
                        //             <div class="text-xs text-gray-700">

                        //             </div>
                        //         </div>
                        //     `;
                        // },
                    },
                },
            ];
        },
        plugins: [
            tagsPlugin,
            recentSearchesPlugin,
        ],
    });
}
