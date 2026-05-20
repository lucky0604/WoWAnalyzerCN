import { ItemLink } from 'interface';
import AlertWarning from 'interface/AlertWarning';
import { Item } from 'parser/core/Events';
import { Component } from 'react';

const WARNING_ITEMS: number[] = [];

interface Props {
  gear: Item[];
}

class ItemWarning extends Component<Props> {
  badItems: number[] = [];
  checkItems() {
    this.props.gear.forEach((item) => {
      if (WARNING_ITEMS.includes(item.id) && !this.badItems.includes(item.id)) {
        this.badItems.push(item.id);
      }
    }, 0);
  }

  render() {
    this.checkItems();
    if (this.badItems.length === 0) {
      return null;
    }
    return (
      <div className="container">
        <AlertWarning style={{ marginBottom: 30 }}>
          由于部分物品效果无法在 WoWAnalyzer 中追踪，本模块可能存在一定误差，导致该玩家的部分统计数据不够准确。这与以下物品有关：
          {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
          <br />
          {this.badItems.map((item) => (
            <ItemLink key={item} id={item} />
          ))}
        </AlertWarning>
      </div>
    );
  }
}

export default ItemWarning;
