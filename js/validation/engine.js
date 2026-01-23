/**
 * 時間割バリデーションエンジン
 * ルールを実行し、エラー・警告・情報を収集する
 */
class ValidationEngine {
    constructor(store) {
        this.store = store;
        this.rules = VALIDATION_RULES;
    }

    /**
     * 全ルールを実行してバリデーション結果を取得
     * @returns {{errors: Array, warnings: Array, info: Array}}
     */
    validate() {
        const results = {
            errors: [],
            warnings: [],
            info: []
        };

        this.rules.forEach(rule => {
            if (!rule.enabled) return;

            try {
                const issues = rule.check(this.store, rule);

                // レベルに応じて分類
                if (rule.level === 'error') {
                    results.errors.push(...issues.map(issue => ({
                        ...issue,
                        ruleId: rule.id,
                        ruleName: rule.name
                    })));
                } else if (rule.level === 'warning') {
                    results.warnings.push(...issues.map(issue => ({
                        ...issue,
                        ruleId: rule.id,
                        ruleName: rule.name
                    })));
                } else if (rule.level === 'info') {
                    results.info.push(...issues.map(issue => ({
                        ...issue,
                        ruleId: rule.id,
                        ruleName: rule.name
                    })));
                }
            } catch (error) {
                console.error(`バリデーションルール "${rule.name}" でエラー:`, error);
                results.errors.push({
                    message: `チェック処理でエラーが発生しました: ${rule.name}`,
                    ruleId: rule.id,
                    ruleName: rule.name,
                    location: null
                });
            }
        });

        return results;
    }

    /**
     * 特定のルールを有効/無効にする
     * @param {string} ruleId - ルールID
     * @param {boolean} enabled - 有効/無効
     */
    setRuleEnabled(ruleId, enabled) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (rule) {
            rule.enabled = enabled;
        }
    }

    /**
     * ルールの閾値を設定
     * @param {string} ruleId - ルールID
     * @param {number} threshold - 閾値
     */
    setRuleThreshold(ruleId, threshold) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (rule && rule.threshold !== undefined) {
            rule.threshold = threshold;
        }
    }

    /**
     * 全ルールの情報を取得
     * @returns {Array} ルール情報の配列
     */
    getRules() {
        return this.rules.map(rule => ({
            id: rule.id,
            name: rule.name,
            level: rule.level,
            enabled: rule.enabled,
            threshold: rule.threshold
        }));
    }

    /**
     * バリデーション結果のサマリーを取得
     * @param {Object} results - validate()の結果
     * @returns {string} サマリー文字列
     */
    getSummary(results) {
        const errorCount = results.errors.length;
        const warningCount = results.warnings.length;
        const infoCount = results.info.length;

        if (errorCount === 0 && warningCount === 0) {
            return '✅ 問題は見つかりませんでした';
        }

        const parts = [];
        if (errorCount > 0) parts.push(`🔴 エラー ${errorCount}件`);
        if (warningCount > 0) parts.push(`⚠️ 警告 ${warningCount}件`);
        if (infoCount > 0) parts.push(`ℹ️ 情報 ${infoCount}件`);

        return parts.join(', ');
    }
}
