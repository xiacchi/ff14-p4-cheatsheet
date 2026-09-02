(function () {
  const MISSING = '未入力';

  function gazeAction(truth) {
    if (truth === null || truth === undefined) return MISSING;
    return truth ? '見ない' : '見る！';
  }

  function personalAction(debuff, truth) {
    if (!debuff || truth === null || truth === undefined) return MISSING;

    if (debuff === 'acceleration') {
      return truth ? '止まる' : '動く';
    }

    if (debuff === 'thunder') {
      return truth ? '散開' : '頭割り';
    }

    if (debuff === 'water') {
      return truth ? '頭割り' : '散開';
    }

    return MISSING;
  }

  function chaosAction(type, truth) {
    if (!type || truth === null || truth === undefined) return MISSING;

    if (type === 'fire') {
      return truth ? 'タケノコ' : '中央';
    }

    if (type === 'water') {
      return truth ? '中央' : 'タケノコ';
    }

    return MISSING;
  }

  function findChaosByType(records, type) {
    return records.find((record) => record.chaosType === type) || null;
  }

  window.P4Rules = {
    MISSING,
    gazeAction,
    personalAction,
    chaosAction,
    findChaosByType,
  };
}());
