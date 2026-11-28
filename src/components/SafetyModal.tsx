import { Modal } from './Modal';
import TrueFocus from '../motion/TrueFocus.jsx';

interface SafetyModalProps {
  open: boolean;
  onClose: () => void;
}

/** 🚨 安全与帮助：独立页面，内容全部为求助路径，不夹带练习推销。 */
export function SafetyModal({ open, onClose }: SafetyModalProps) {
  return (
    <Modal
      open={open}
      title="🚨 安全与帮助"
      onClose={onClose}
      label="safety"
      wide
      footer={
        <button type="button" className="button ghost" onClick={onClose}>
          先回到山谷
        </button>
      }
    >
      <div className="safety-page">
        <p className="safety-standing">
          本工具全部为自助心理调节练习，不是心理治疗，不能替代医院、心理咨询师的专业干预。如果长期陷入痛苦，请一定寻求专业人员帮助。
        </p>

        <section className="safety-block is-urgent">
          <h3>紧急提示</h3>
          <p>
            如果你此刻有伤害自己的念头，请立刻拨打 <strong>120</strong>（急救）或 <strong>110</strong>
            （报警），或直接前往最近的医院急诊。也可以先联系一个你信得过的人，让他陪着你。
          </p>
          <p className="safety-note">
            在这种时候，不要一个人待着。把手边能伤到自己的东西先放远一点，是件值得做的事。
          </p>
        </section>

        <section className="safety-block">
          <h3>就诊指引</h3>
          <TrueFocus
            sentence="综合医院的精神科 / 心理科门诊，或当地精神卫生中心；|学校心理中心、辅导员转介的正规渠道（在校学生通常免费）；|正规心理咨询机构：确认咨询师有执业资质，避免在非正规平台购买「快速疗愈」服务。"
            focusStyle="underline"
            blurAmount={1.4}
            animationDuration={0.5}
            pauseBetweenAnimations={4}
          />
          <p className="safety-note">
            挂号时说不清自己怎么了也没关系，把「睡不着、心慌、持续低落」这类最直接的感受讲出来就够。
          </p>
        </section>

        <section className="safety-block">
          <h3>免责声明</h3>
          <p>
            回音谷是陪伴与自助调节工具，不提供诊断、治疗、用药建议，也不承诺任何疗效。页面里的练习只能做临时缓解，不能替代专业干预。
          </p>
        </section>

        <p className="safety-foot">
          如果你愿意，也可以回到「静一下心」做一次很短的练习，等这一阵过去，再去找能帮你的人。
        </p>
      </div>
    </Modal>
  );
}
