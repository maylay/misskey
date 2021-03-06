import Vue, { VNode } from 'vue';
import { length } from 'stringz';
import { MfmForest } from '../../../../../mfm/parser';
import parse from '../../../../../mfm/parse';
import MkUrl from './url.vue';
import MkMention from './mention.vue';
import { concat, sum } from '../../../../../prelude/array';
import MkFormula from './formula.vue';
import MkGoogle from './google.vue';
import syntaxHighlight from '../../../../../mfm/syntax-highlight';
import { host } from '../../../config';
import { preorderF, countNodesF } from '../../../../../prelude/tree';

function sumTextsLength(ts: MfmForest): number {
	const textNodes = preorderF(ts).filter(n => n.type === 'text');
	return sum(textNodes.map(x => length(x.props.text)));
}

export default Vue.component('misskey-flavored-markdown', {
	props: {
		text: {
			type: String,
			required: true
		},
		shouldBreak: {
			type: Boolean,
			default: true
		},
		plainText: {
			type: Boolean,
			default: false
		},
		author: {
			type: Object,
			default: null
		},
		i: {
			type: Object,
			default: null
		},
		customEmojis: {
			required: false,
		}
	},

	render(createElement) {
		if (this.text == null || this.text == '') return;

		const ast = parse(this.text, this.plainText);

		let bigCount = 0;
		let motionCount = 0;

		const genEl = (ast: MfmForest) => concat(ast.map((token): VNode[] => {
			switch (token.node.type) {
				case 'text': {
					const text = token.node.props.text.replace(/(\r\n|\n|\r)/g, '\n');

					if (this.shouldBreak) {
						const x = text.split('\n')
							.map(t => t == '' ? [createElement('br')] : [createElement('span', t), createElement('br')]);
						x[x.length - 1].pop();
						return x;
					} else {
						return [createElement('span', text.replace(/\n/g, ' '))];
					}
				}

				case 'bold': {
					return [createElement('b', genEl(token.children))];
				}

				case 'strike': {
					return [createElement('del', genEl(token.children))];
				}

				case 'italic': {
					return (createElement as any)('i', {
						attrs: {
							style: 'font-style: oblique;'
						},
					}, genEl(token.children));
				}

				case 'big': {
					bigCount++;
					const isLong = sumTextsLength(token.children) > 10 || countNodesF(token.children) > 5;
					const isMany = bigCount > 3;
					return (createElement as any)('strong', {
						attrs: {
							style: `display: inline-block; font-size: ${ isMany ? '100%' : '150%' };`
						},
						directives: [this.$store.state.settings.disableAnimatedMfm || isLong || isMany ? {} : {
							name: 'animate-css',
							value: { classes: 'tada', iteration: 'infinite' }
						}]
					}, genEl(token.children));
				}

				case 'small': {
					return [createElement('small', genEl(token.children))];
				}

				case 'center': {
					return [createElement('div', {
						attrs: {
							style: 'text-align:center;'
						}
					}, genEl(token.children))];
				}

				case 'motion': {
					motionCount++;
					const isLong = sumTextsLength(token.children) > 10 || countNodesF(token.children) > 5;
					const isMany = motionCount > 3;
					return (createElement as any)('span', {
						attrs: {
							style: 'display: inline-block;'
						},
						directives: [this.$store.state.settings.disableAnimatedMfm || isLong || isMany ? {} : {
							name: 'animate-css',
							value: { classes: 'rubberBand', iteration: 'infinite' }
						}]
					}, genEl(token.children));
				}

				case 'url': {
					return [createElement(MkUrl, {
						key: Math.random(),
						props: {
							url: token.node.props.url,
							target: '_blank',
							style: 'color:var(--mfmLink);'
						}
					})];
				}

				case 'link': {
					return [createElement('a', {
						attrs: {
							class: 'link',
							href: token.node.props.url,
							target: '_blank',
							title: token.node.props.url,
							style: 'color:var(--mfmLink);'
						}
					}, genEl(token.children))];
				}

				case 'mention': {
					return [createElement(MkMention, {
						key: Math.random(),
						props: {
							host: (token.node.props.host == null && this.author && this.author.host != null ? this.author.host : token.node.props.host) || host,
							username: token.node.props.username
						}
					})];
				}

				case 'hashtag': {
					return [createElement('router-link', {
						key: Math.random(),
						attrs: {
							to: `/tags/${encodeURIComponent(token.node.props.hashtag)}`,
							style: 'color:var(--mfmHashtag);'
						}
					}, `#${token.node.props.hashtag}`)];
				}

				case 'blockCode': {
					return [createElement('pre', {
						class: 'code'
					}, [
						createElement('code', {
							domProps: {
								innerHTML: syntaxHighlight(token.node.props.code)
							}
						})
					])];
				}

				case 'inlineCode': {
					return [createElement('code', {
						domProps: {
							innerHTML: syntaxHighlight(token.node.props.code)
						}
					})];
				}

				case 'quote': {
					if (this.shouldBreak) {
						return [createElement('div', {
							attrs: {
								class: 'quote'
							}
						}, genEl(token.children))];
					} else {
						return [createElement('span', {
							attrs: {
								class: 'quote'
							}
						}, genEl(token.children))];
					}
				}

				case 'title': {
					return [createElement('div', {
						attrs: {
							class: 'title'
						}
					}, genEl(token.children))];
				}

				case 'emoji': {
					const customEmojis = (this.$root.getMetaSync() || { emojis: [] }).emojis || [];
					return [createElement('mk-emoji', {
						key: Math.random(),
						attrs: {
							emoji: token.node.props.emoji,
							name: token.node.props.name
						},
						props: {
							customEmojis: this.customEmojis || customEmojis,
							normal: this.plainText
						}
					})];
				}

				case 'math': {
					//const MkFormula = () => import('./formula.vue').then(m => m.default);
					return [createElement(MkFormula, {
						key: Math.random(),
						props: {
							formula: token.node.props.formula
						}
					})];
				}

				case 'search': {
					//const MkGoogle = () => import('./google.vue').then(m => m.default);
					return [createElement(MkGoogle, {
						key: Math.random(),
						props: {
							q: token.node.props.query
						}
					})];
				}

				default: {
					console.log('unknown ast type:', token.node.type);

					return [];
				}
			}
		}));

		// Parse ast to DOM
		return createElement('span', genEl(ast));
	}
});
